import { gameDatabase } from "../../server.js";
import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as z from "zod";

/**
 * Schema for policy summary information
 */
const PolicySummarySchema = z.object({
  Type: z.string(),
  Name: z.string(),
  Help: z.string(),
  Era: z.string().nullable(),
  Cost: z.number(),
  Branch: z.string().nullable()
});

/**
 * Schema for full policy information including relations
 */
const PolicyReportSchema = PolicySummarySchema.extend({
  Strategy: z.string().nullable(),
  Level: z.number().nullable(),
  PrereqPolicies: z.array(z.string())
});

type PolicySummary = z.infer<typeof PolicySummarySchema>;
type PolicyReport = z.infer<typeof PolicyReportSchema>;

/**
 * Tool for querying policy information from the game database
 */
class GetPolicyTool extends DatabaseQueryTool<PolicySummary, PolicyReport> {
  /**
   * Unique identifier for the get policy tool
   */
  readonly name = "get-policy";

  /**
   * Human-readable description of the get policy tool
   */
  readonly description = "Retrieves policy information from the Civilization V game database with listing and fuzzy search capabilities";

  /**
   * Schema for policy summary
   */
  protected readonly summarySchema = PolicySummarySchema;

  /**
   * Schema for full policy information
   */
  protected readonly fullSchema = PolicyReportSchema;

  /**
   * Optional annotations for the get policy tool
   */
  readonly annotations = undefined;

  /**
   * Fetch policy summaries from database
   */
  protected async fetchSummaries(): Promise<PolicySummary[]> {
    return await gameDatabase.getDatabase()
      .selectFrom("Policies")
      .select([
        'Type', 
        'Description as Name', 
        'Help', 
        'UnlocksPolicyBranchEra as Era',
        'CultureCost as Cost',
        'PolicyBranchType as Branch'
      ])
      .execute() as PolicySummary[];
  }
  
  protected fetchFullInfo = getPolicy;
}

export default new GetPolicyTool();

/**
 * Fetch full policy information for a specific policy
 */
export async function getPolicy(policyType: string) {
  // Fetch base policy info
  const db = gameDatabase.getDatabase();
  const policy = await db
    .selectFrom('Policies')
    .selectAll()
    .where('Type', '=', policyType)
    .executeTakeFirst();
  
  if (!policy) {
    throw new Error(`Policy ${policyType} not found`);
  }
  
  // Get prerequisite policies
  const prereqPolicies = await db
    .selectFrom('Policy_PrereqPolicies as pp')
    .innerJoin('Policies as p', 'p.Type', 'pp.PrereqPolicy')
    .select(['p.Description'])
    .where('pp.PolicyType', '=', policyType)
    .execute();
  
  // Construct the full policy object
  return {
    Type: policy.Type,
    Name: policy.Description!,
    Help: policy.Help!,
    Era: policy.UnlocksPolicyBranchEra,
    Cost: policy.CultureCost!,
    Branch: policy.PolicyBranchType,
    Strategy: policy.Strategy,
    Level: policy.Level,
    PrereqPolicies: prereqPolicies.map(p => p.Description!)
  };
}