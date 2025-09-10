import { gameDatabase } from "../../server.js";
import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as changeCase from "change-case";
import * as z from "zod";

/**
 * Schema for policy summary information
 */
const PolicySummarySchema = z.object({
  Type: z.string(),
  Name: z.string(),
  Help: z.string(),
  Era: z.string().nullable(),
  Branch: z.string().nullable()
});

/**
 * Schema for full policy information including relations
 */
const PolicyReportSchema = PolicySummarySchema.extend({
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
   * Default implementation searches common fields
   */
  protected getSearchFields(): string[] {
    return [...super.getSearchFields(), "Branch"]
  }

  /**
   * Fetch policy summaries from database
   */
  protected async fetchSummaries(): Promise<PolicySummary[]> {
    var Summaries = await gameDatabase.getDatabase()
      .selectFrom("Policies")
      .where('Policies.Help', '!=', 'NULL')
      .leftJoin('PolicyBranchTypes as b', 'b.Type', 'PolicyBranchType')
      .leftJoin('PolicyBranchTypes as c', 'c.FreePolicy', 'Policies.Type')
      .select([
        'Policies.Type', 
        'Policies.Description as Name', 
        'Policies.Help', 
        'b.EraPrereq as Era',
        'c.EraPrereq as Era2',
        'b.Description as Branch',
        'c.Description as Branch2',
        'c.Help as Help2'
      ])
      .execute();
    Summaries.forEach(p => {
      p.Era = changeCase.pascalCase((p.Era ?? p.Era2 ?? "").substring(4)),
      p.Branch = p.Branch ?? p.Branch2;
      p.Help = p.Help2 ?? p.Help;
      delete (p as any).Era2;
      delete (p as any).Branch2;
      delete (p as any).Help2;
    })
    return Summaries as PolicySummary[];
  }
  
  protected fetchFullInfo = getPolicy;
}

/**
 * Creates a new instance of the get policy tool
 */
export default function createGetPolicyTool() {
  return new GetPolicyTool();
}

/**
 * Fetch full policy information for a specific policy
 */
export async function getPolicy(policyType: string) {
  // Fetch base policy info
  const db = gameDatabase.getDatabase();
  const policy = await db
    .selectFrom('Policies')
    .where('Policies.Type', '=', policyType)
    .leftJoin('PolicyBranchTypes as b', 'b.Type', 'PolicyBranchType')
    .leftJoin('PolicyBranchTypes as c', 'c.FreePolicy', 'Policies.Type')
    .select([
      'Policies.Type', 
      'Policies.Description as Name', 
      'Policies.Help', 
      'Policies.Level',
      'b.EraPrereq as Era',
      'c.EraPrereq as Era2',
      'b.Description as Branch',
      'c.Description as Branch2',
      'c.Help as Help2'
    ])
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
    Name: policy.Name!,
    Help: policy.Help2 ?? policy.Help!,
    Era: changeCase.pascalCase((policy.Era ?? policy.Era2 ?? "").substring(4)),
    Branch: policy.Branch ?? policy.Branch2,
    Level: policy.Level,
    PrereqPolicies: prereqPolicies.map(p => p.Description!)
  };
}