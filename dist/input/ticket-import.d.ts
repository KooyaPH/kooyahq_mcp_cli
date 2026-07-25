export type TicketImportFormat = 'json' | 'csv';
export declare const TICKET_IMPORT_CSV_HEADERS: readonly ["importRef", "title", "ticketType", "status", "priority", "reporterEmail", "assigneeEmail", "points", "tags", "parentRef", "rootEpicRef", "startDate", "endDate", "dueDate", "description", "acceptanceCriteriaJson", "documentsJson", "commentsJson", "relatedRefs", "githubBranchName", "githubTargetBranch", "githubPullRequestUrl", "githubStatus"];
export declare const TICKET_IMPORT_ROW_FIELDS: readonly [{
    readonly name: "importRef";
    readonly type: "string";
}, {
    readonly name: "title";
    readonly type: "string";
}, {
    readonly name: "ticketType";
    readonly type: "string";
}, {
    readonly name: "status";
    readonly type: "string";
}, {
    readonly name: "priority";
    readonly type: "string";
}, {
    readonly name: "reporterEmail";
    readonly type: "string";
}, {
    readonly name: "assigneeEmail";
    readonly type: "string";
}, {
    readonly name: "points";
    readonly type: "number";
}, {
    readonly name: "tags";
    readonly type: "string[] | comma-separated string";
}, {
    readonly name: "parentRef";
    readonly type: "string";
}, {
    readonly name: "rootEpicRef";
    readonly type: "string";
}, {
    readonly name: "startDate";
    readonly type: "YYYY-MM-DD string";
}, {
    readonly name: "endDate";
    readonly type: "YYYY-MM-DD string";
}, {
    readonly name: "dueDate";
    readonly type: "YYYY-MM-DD string";
}, {
    readonly name: "description";
    readonly type: "string";
}, {
    readonly name: "acceptanceCriteria";
    readonly type: "array";
}, {
    readonly name: "documents";
    readonly type: "array";
}, {
    readonly name: "comments";
    readonly type: "array";
}, {
    readonly name: "relatedRefs";
    readonly type: "string[] | comma-separated string";
}, {
    readonly name: "github";
    readonly type: "object";
}];
export declare function parseTicketImport(bytes: Uint8Array, format: TicketImportFormat, maxBytes: number, maxItems: number): Array<Record<string, unknown>>;
