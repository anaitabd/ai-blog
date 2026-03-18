declare module 'google-trends-api' {
  interface RelatedQueriesOptions {
    keyword: string
    geo?: string
    hl?: string
    startTime?: Date
    endTime?: Date
  }
  function relatedQueries(options: RelatedQueriesOptions): Promise<string>
  export = { relatedQueries }
}
