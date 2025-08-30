import z from "zod";
import { registerTool } from ".";

/**
 * Example tool
 */
registerTool("add", (Server) => {
    Server.registerTool("add",
        {
            title: "Addition Tool",
            description: "Add two numbers",
            inputSchema: { a: z.number(), b: z.number() }
        },
        async ({ a, b }) => ({
            content: [{ type: "text", text: String(a + b) }]
        })
    );
});