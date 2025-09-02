/**
 * TestEvent
 * 
 * Development and testing event used within the Vox Deorum system to validate
 * the communication flow between the Community Patch DLL and the Lua scripting system.
 * This is a development-only event and should not be present in production builds.
 */
export interface TestEvent {
  /** First test parameter (hardcoded to -1) */
  Arg1: number;
  
  /** Second test parameter (hardcoded to -1) */
  Arg2: number;
  
  /** Third test parameter (hardcoded to -1) */
  Arg3: number;
  
  /** Fourth test parameter (hardcoded to -1) */
  Arg4: number;
}