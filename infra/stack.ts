import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as path from 'path'

export class AiBlogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ─── DynamoDB Topics Table ──────────────────────────────
    const topicsTable = new dynamodb.Table(this, 'TopicsTable', {
      tableName: 'ai-blog-topics',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    topicsTable.addGlobalSecondaryIndex({
      indexName: 'status-priority-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'priority', type: dynamodb.AttributeType.NUMBER },
    })

    topicsTable.addGlobalSecondaryIndex({
      indexName: 'keyword-index',
      partitionKey: { name: 'keyword', type: dynamodb.AttributeType.STRING },
    })

    // ─── VPC for RDS ─────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'BlogVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
      ],
    })

    // ─── RDS PostgreSQL ──────────────────────────────────────
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      credentials: rds.Credentials.fromGeneratedSecret('aiblog', {
        secretName: 'ai-blog-db-secret',
      }),
      databaseName: 'aiblog',
      allocatedStorage: 20,
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: false,
      publiclyAccessible: true,
      storageEncrypted: true,
    })
    database.connections.allowFromAnyIpv4(ec2.Port.tcp(5432))

    // ─── S3 Bucket for Images ───────────────────────────────
    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `ai-blog-images-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ─── S3 Bucket for YouTube Shorts Output ───────────────
    const shortsBucket = new s3.Bucket(this, 'ShortsBucket', {
      bucketName: `ai-blog-shorts-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ─── S3 Bucket for Static Assets (bg music, etc.) ───────
    const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `ai-blog-assets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ─── CloudFront CDN for Images ──────────────────────────
    const imagesCdn = new cloudfront.Distribution(this, 'ImagesCdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(imagesBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    })

    // ─── Bedrock IAM Policy ─────────────────────────────────
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    })

    const lambdaDir = path.join(__dirname, '..', 'lambda')

    const sharedEnv = {
      TOPICS_TABLE: topicsTable.tableName,
      S3_BUCKET: imagesBucket.bucketName,
      CLOUDFRONT_DOMAIN: imagesCdn.distributionDomainName,
      BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      NODE_OPTIONS: '--enable-source-maps',
    }

    // ─── Lambda: Trend Fetcher ──────────────────────────────
    const trendFetcherFn = new NodejsFunction(this, 'TrendFetcher', {
      functionName: 'ai-blog-trend-fetcher',
      entry: path.join(lambdaDir, 'trend-fetcher', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: sharedEnv,
    })
    topicsTable.grantWriteData(trendFetcherFn)

    // ─── EventBridge: 6am UTC daily trend fetch ─────────────
    new events.Rule(this, 'TrendFetcherSchedule', {
      ruleName: 'ai-blog-trend-fetcher-schedule',
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [new targets.LambdaFunction(trendFetcherFn)],
    })

    // ─── Lambda: Topic Seeder ───────────────────────────────
    const seederFn = new NodejsFunction(this, 'TopicSeeder', {
      functionName: 'ai-blog-topic-seeder',
      entry: path.join(lambdaDir, 'topic-seeder', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      // Needs time for parallel RSS + Reddit + Trends fetches + Bedrock call
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: sharedEnv,
    })
    // Needs read access for duplicate keyword checks + write to insert new topics
    topicsTable.grantReadWriteData(seederFn)
    // Needs Bedrock to call Claude Haiku for topic ideation
    seederFn.addToRolePolicy(bedrockPolicy)

    // Run every Monday at 7am UTC — fills the queue with a fresh batch of
    // trend-grounded topics at the start of each week
    new events.Rule(this, 'SeederSchedule', {
      ruleName: 'ai-blog-seeder-schedule',
      schedule: events.Schedule.cron({ minute: '0', hour: '7', weekDay: 'MON' }),
      targets: [new targets.LambdaFunction(seederFn)],
    })

    // ─── Lambda: Content Generator ──────────────────────────
    const generatorFn = new NodejsFunction(this, 'ContentGenerator', {
      functionName: 'ai-blog-content-generator',
      entry: path.join(lambdaDir, 'content-generator', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: sharedEnv,
    })
    generatorFn.addToRolePolicy(bedrockPolicy)
    topicsTable.grantReadWriteData(generatorFn)

    // ─── Lambda: Publisher ──────────────────────────────────
    const publisherFn = new NodejsFunction(this, 'Publisher', {
      functionName: 'ai-blog-publisher',
      entry: path.join(lambdaDir, 'publisher', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ...sharedEnv,
        NEXTJS_SITE_URL: process.env.NEXTJS_SITE_URL ?? 'https://main.d33pu7f2pby8t4.amplifyapp.com',
        // WEBHOOK_SECRET is read from SSM at runtime — not embedded here
      },
    })
    publisherFn.addToRolePolicy(bedrockPolicy)
    publisherFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${imagesBucket.bucketArn}/*`],
    }))
    publisherFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/webhook-secret`],
    }))
    topicsTable.grantReadWriteData(publisherFn)

    // ─── Step Functions State Machine ───────────────────────
    const generateStep = new tasks.LambdaInvoke(this, 'GenerateContent', {
      lambdaFunction: generatorFn,
      outputPath: '$.Payload',
    })

    const publishStep = new tasks.LambdaInvoke(this, 'PublishContent', {
      lambdaFunction: publisherFn,
      outputPath: '$.Payload',
    })

    const waitStep = new sfn.Wait(this, 'WaitBeforeRetry', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(15)),
    })

    const failState = new sfn.Fail(this, 'PipelineFailed', {
      error: 'PipelineFailed',
      cause: 'Pipeline failed after all retries',
    })

    // ─── DLQs for new Lambdas ────────────────────────────────
    const ytGeneratorDlq  = new sqs.Queue(this, 'YoutubeGeneratorDLQ',  { queueName: 'ai-blog-yt-generator-dlq'  })
    const ytPublisherDlq  = new sqs.Queue(this, 'YoutubePublisherDLQ',  { queueName: 'ai-blog-yt-publisher-dlq'  })
    const emailNotifierDlq = new sqs.Queue(this, 'EmailNotifierDLQ',    { queueName: 'ai-blog-email-notifier-dlq' })
    const pinterestDlq    = new sqs.Queue(this, 'PinterestPublisherDLQ', { queueName: 'ai-blog-pinterest-dlq' })
    // ─── FFmpeg Lambda Layer ─────────────────────────────────
    // Static amd64 binary from johnvansickle.com — run scripts/download-ffmpeg-layer.sh
    // before deploying to populate lambda/layers/ffmpeg/bin/ffmpeg
    const ffmpegLayer = new lambda.LayerVersion(this, 'FfmpegLayer', {
      layerVersionName: 'ai-blog-ffmpeg',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'layers', 'ffmpeg')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Static FFmpeg binary for Amazon Linux 2 x86_64 — video assembly for YouTube Shorts',
    })

    // ─── Lambda: YouTube Shorts Generator ───────────────────
    const youtubeGeneratorFn = new NodejsFunction(this, 'YoutubeShortGenerator', {
      functionName: 'ai-blog-youtube-shorts-generator',
      entry: path.join(lambdaDir, 'youtube-shorts-generator', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(25),          // Nova Reel polling (up to 15 min) + FFmpeg assembly
      memorySize: 10240,                           // FFmpeg 4K→1080p encoding needs max headroom
      ephemeralStorageSize: cdk.Size.mebibytes(10240), // 10 GB /tmp for 9 raw scenes + final output
      deadLetterQueue: ytGeneratorDlq,
      layers: [ffmpegLayer],
      environment: {
        ...sharedEnv,
        FFMPEG_PATH:       '/opt/bin/ffmpeg',
        NOVA_REEL_MODEL:   'amazon.nova-reel-v1:1',
        NOVA_CANVAS_MODEL: 'amazon.nova-canvas-v1:0',
        POLLY_VOICE_ID:    'Stephen',
        SHORTS_BUCKET:     shortsBucket.bucketName,
        ASSETS_BUCKET:     assetsBucket.bucketName,
        PIXABAY_API_KEY:   process.env.PIXABAY_API_KEY ?? '',
      },
    })

    youtubeGeneratorFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:StartAsyncInvoke',
        'bedrock:GetAsyncInvoke',
        'bedrock:ListAsyncInvokes',
      ],
      resources: ['*'],
    }))
    youtubeGeneratorFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['polly:SynthesizeSpeech'],
      resources: ['*'],
    }))
    imagesBucket.grantReadWrite(youtubeGeneratorFn)
    assetsBucket.grantRead(youtubeGeneratorFn)
    shortsBucket.grantPut(youtubeGeneratorFn)
    youtubeGeneratorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/youtube/*`,
      ],
    }))

    // ─── Lambda: YouTube Shorts Publisher ───────────────────
    const youtubePublisherFn = new NodejsFunction(this, 'YoutubeShortPublisher', {
      functionName: 'ai-blog-youtube-shorts-publisher',
      entry: path.join(lambdaDir, 'youtube-shorts-publisher', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      deadLetterQueue: ytPublisherDlq,
      environment: {
        ...sharedEnv,
        NEXTJS_SITE_URL:      process.env.NEXTJS_SITE_URL      ?? 'https://main.d33pu7f2pby8t4.amplifyapp.com',
        INTERNAL_SECRET:      process.env.INTERNAL_SECRET      ?? '6c13452975531ad43e1fd57b46fd003a03606dc7a5d2b723b5c9b5e6cad4a2ee',
        GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID     ?? '',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    })

    imagesBucket.grantRead(youtubePublisherFn)
    youtubePublisherFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/youtube/*`,
      ],
    }))

    // ─── Lambda: Email Notifier ──────────────────────────────
    const emailNotifierFn = new NodejsFunction(this, 'EmailNotifier', {
      functionName: 'ai-blog-email-notifier',
      entry: path.join(lambdaDir, 'email-notifier', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      deadLetterQueue: emailNotifierDlq,
      environment: {
        ...sharedEnv,
        NEXTJS_SITE_URL:  process.env.NEXTJS_SITE_URL  ?? 'https://main.d33pu7f2pby8t4.amplifyapp.com',
        INTERNAL_SECRET:  process.env.INTERNAL_SECRET  ?? '6c13452975531ad43e1fd57b46fd003a03606dc7a5d2b723b5c9b5e6cad4a2ee',
      },
    })

    emailNotifierFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }))
    emailNotifierFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/ses/*`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/admin-email`,
      ],
    }))

    // ─── SSM: SES from-email ─────────────────────────────────
    // NOTE: /wealthbeginners/ses/from-email is managed by scripts/deploy.sh
    // (aws ssm put-parameter). CDK does not own it — avoids conflicts on re-deploy.
    // ─── Lambda: Pinterest Publisher ──────────────────────────────────────
    const pinterestPublisherFn = new NodejsFunction(this, 'PinterestPublisher', {
      functionName: 'ai-blog-pinterest-publisher',
      entry: path.join(lambdaDir, 'pinterest-publisher', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      deadLetterQueue: pinterestDlq,
      environment: {
        ...sharedEnv,
        NEXTJS_SITE_URL: process.env.NEXTJS_SITE_URL ?? 'https://main.d33pu7f2pby8t4.amplifyapp.com',
      },
    })

    // S3 read/write for Pinterest image generation + upload
    imagesBucket.grantReadWrite(pinterestPublisherFn)

    // Bedrock for Nova Canvas image generation
    pinterestPublisherFn.addToRolePolicy(bedrockPolicy)

    // SSM read for Pinterest credentials (board IDs, access token)
    pinterestPublisherFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/pinterest/*`,
      ],
    }))
    // Also need webhook secret to update post record
    pinterestPublisherFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/wealthbeginners/webhook-secret`,
      ],
    }))
    // ─── Step Functions — post-publish parallel branch ───────
    const youtubeGenerateStep = new tasks.LambdaInvoke(this, 'GenerateYoutubeShorts', {
      lambdaFunction: youtubeGeneratorFn,
      outputPath: '$.Payload',
    })

    const youtubePublishStep = new tasks.LambdaInvoke(this, 'PublishYoutubeShorts', {
      lambdaFunction: youtubePublisherFn,
      outputPath: '$.Payload',
    })

    const emailNotifyStep = new tasks.LambdaInvoke(this, 'NotifySubscribers', {
      lambdaFunction: emailNotifierFn,
      outputPath: '$.Payload',
    })
    // ─── Pinterest Step Functions states ─────────────────────────────────
    const pinterestGenerateStep = new tasks.LambdaInvoke(this, 'GeneratePinterestImage', {
      lambdaFunction: pinterestPublisherFn,
      payload: sfn.TaskInput.fromObject({
        action: 'generate_image',
        'postId.$': '$.postId',
        'title.$': '$.title',
        'slug.$': '$.slug',
        'category.$': '$.postCategory',
      }),
      outputPath: '$.Payload',
    })

    const pinterestPublishStep = new tasks.LambdaInvoke(this, 'PublishToPinterest', {
      lambdaFunction: pinterestPublisherFn,
      payload: sfn.TaskInput.fromObject({
        action: 'publish_pin',
        'postId.$': '$.postId',
        'imageUrl.$': '$.pinterestImageUrl',
        'title.$': '$.title',
        'slug.$': '$.slug',
      }),
      outputPath: '$.Payload',
    })

    const pinterestFailed = new sfn.Pass(this, 'PinterestFailed', {
      result: sfn.Result.fromObject({ status: 'pinterest_failed' }),
    })
    pinterestGenerateStep.addCatch(pinterestFailed, { errors: ['States.ALL'], resultPath: '$.pinterestError' })
    pinterestPublishStep.addCatch(pinterestFailed, { errors: ['States.ALL'], resultPath: '$.pinterestError' })
    const pinterestFlow = pinterestGenerateStep.next(pinterestPublishStep)
    // Error handling for new steps (non-blocking — pipeline already succeeded)
    youtubeGenerateStep.addCatch(new sfn.Pass(this, 'YoutubeGeneratorFailed'), {
      errors: ['States.ALL'], resultPath: '$.youtubeError',
    })
    youtubePublishStep.addCatch(new sfn.Pass(this, 'YoutubePublisherFailed'), {
      errors: ['States.ALL'], resultPath: '$.youtubeError',
    })
    emailNotifyStep.addCatch(new sfn.Pass(this, 'EmailNotifierFailed'), {
      errors: ['States.ALL'], resultPath: '$.emailError',
    })

    const successState = new sfn.Succeed(this, 'PipelineSuccess')

    const youtubeFlow = youtubeGenerateStep.next(youtubePublishStep)
    const emailFlow   = emailNotifyStep

    const postPublishParallel = new sfn.Parallel(this, 'PostPublishParallel')
      .branch(youtubeFlow)
      .branch(emailFlow)
      .branch(pinterestFlow)

    postPublishParallel.next(successState)
    postPublishParallel.addCatch(failState, { errors: ['States.ALL'], resultPath: '$.parallelError' })

    // Only run YouTube + email when the post is actually PUBLISHED.
    // Pipeline now saves as REVIEW by default — skip post-publish work.
    const reviewGuard = new sfn.Choice(this, 'ReviewGuard')
      .when(sfn.Condition.stringEquals('$.postStatus', 'PUBLISHED'), postPublishParallel)
      .otherwise(successState)

    publishStep.next(reviewGuard)
    generateStep.addCatch(failState, { errors: ['States.ALL'], resultPath: '$.error' })
    publishStep.addCatch(failState, { errors: ['States.ALL'], resultPath: '$.error' })

    const checkQuality = new sfn.Choice(this, 'CheckQuality')
      .when(sfn.Condition.booleanEquals('$.shouldRetry', true), waitStep.next(generateStep))
      .otherwise(publishStep)

    const definition = generateStep.next(checkQuality)

    const stateMachine = new sfn.StateMachine(this, 'BlogPipeline', {
      stateMachineName: 'ai-blog-pipeline',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(30),
    })

    // ─── Lambda: Topic Picker ───────────────────────────────
    const pickerFn = new NodejsFunction(this, 'TopicPicker', {
      functionName: 'ai-blog-topic-picker',
      entry: path.join(lambdaDir, 'topic-picker', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(1),
      environment: {
        ...sharedEnv,
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
    })
    topicsTable.grantReadWriteData(pickerFn)
    stateMachine.grantStartExecution(pickerFn)

    // ─── EventBridge: 3x per day schedule ──────────────────
    new events.Rule(this, 'PipelineSchedule', {
      ruleName: 'ai-blog-daily-schedule',
      schedule: events.Schedule.cron({ minute: '0', hour: '7,13,19' }),
      targets: [new targets.LambdaFunction(pickerFn)],
    })

    // ─── YouTube On-Demand State Machine ───────────────────
    // Separate machine so admin can trigger Shorts for any published post
    // without running the full content pipeline.
    const ytOdGenerate = new tasks.LambdaInvoke(this, 'YtOdGenerate', {
      lambdaFunction: youtubeGeneratorFn,
      outputPath: '$.Payload',
    })
    const ytOdPublish = new tasks.LambdaInvoke(this, 'YtOdPublish', {
      lambdaFunction: youtubePublisherFn,
      outputPath: '$.Payload',
    })
    ytOdGenerate.addCatch(new sfn.Fail(this, 'YtOdFailed', {
      error: 'YoutubeFailed', cause: 'YouTube generation or publish failed',
    }), { errors: ['States.ALL'], resultPath: '$.error' })
    ytOdPublish.addCatch(new sfn.Fail(this, 'YtOdPublishFailed', {
      error: 'YoutubePublishFailed', cause: 'YouTube publish failed',
    }), { errors: ['States.ALL'], resultPath: '$.error' })

    const youtubeOnDemandMachine = new sfn.StateMachine(this, 'YoutubeOnDemandMachine', {
      stateMachineName: 'ai-blog-youtube-on-demand',
      definitionBody: sfn.DefinitionBody.fromChainable(ytOdGenerate.next(ytOdPublish)),
      timeout: cdk.Duration.minutes(30),
    })

    // ─── Outputs ────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ImagesCdnUrl', {
      value: `https://${imagesCdn.distributionDomainName}`,
      description: 'Add this as CLOUDFRONT_DOMAIN in your .env',
    })
    new cdk.CfnOutput(this, 'TopicsTableName', { value: topicsTable.tableName })
    new cdk.CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn })
    new cdk.CfnOutput(this, 'YoutubeOnDemandArn', { value: youtubeOnDemandMachine.stateMachineArn })
    new cdk.CfnOutput(this, 'ImagesBucketName', { value: imagesBucket.bucketName })
    new cdk.CfnOutput(this, 'YoutubeGeneratorDLQUrl',  { value: ytGeneratorDlq.queueUrl })
    new cdk.CfnOutput(this, 'YoutubePublisherDLQUrl',  { value: ytPublisherDlq.queueUrl })
    new cdk.CfnOutput(this, 'EmailNotifierDLQUrl',     { value: emailNotifierDlq.queueUrl })
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    })
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: database.secret!.secretArn,
      description: 'Secrets Manager ARN — used by aws:setup to build DATABASE_URL',
    })
  }
}
