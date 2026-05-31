import { useMcpServerSettings } from '@/features/settings/hooks/useMcpServerSettings';
import { query, trpc } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';
import type { Tool } from '@tiny-chat/shared/src/types/tool.ts';
import frontend from '@/tools';
import type { z } from 'zod';
import { McpService } from '../services/McpService';
import { useMemo } from 'react';

export const mcpToolsQueryKey = ['mcp-servers'] as const;

export const useTools = () => {
  const { mcpServerSettings } = useMcpServerSettings();
  const { data: mcpServerSettingsData } = mcpServerSettings;

  const builtInTools = useQuery({
    ...query.capabilities.listTools.queryOptions(),
    select: (data) => [
      ...frontend,
      ...data.map((g) => ({
        ...g,
        tools: g.tools.map(
          (t): Tool<z.ZodAny, z.ZodAny, z.ZodAny> => ({
            ...t,
            run: (ctx, input, userInput) => {
              return trpc.capabilities.callTool.mutate({
                name: t.name,
                context: ctx,
                input: input as never,
                userInput: userInput as never,
              });
            },
          }),
        ),
      })),
    ],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const mcpTools = useQuery({
    queryFn: async () => {
      const mcps = await McpService.connect(mcpServerSettingsData);
      return (
        mcps?.map(({ server, client, tools, error }, i) => ({
          server,
          client,
          error,
          toolGroup: {
            name: `mcp:${server.name}`,
            tools: tools.map(
              (t): Tool<z.ZodAny, z.ZodAny, z.ZodAny> => ({
                name: t.name,
                description: t.description ?? '',
                input: t.inputSchema,
                output: t.outputSchema,
                run: async (_, input) => {
                  console.log('Running tool from MCP:', _, input);
                  const output = await client.callTool({
                    name: t.name,
                    arguments: input as never,
                  });
                  console.log('Output:', _, output);
                  return output;
                },
              }),
            ),
            instructions: client.getInstructions()
              ? {
                  heading: `MCP Server ${i + 1} (${server.name})`,
                  body: client.getInstructions()!,
                }
              : undefined,
          },
        })) ?? []
      );
    },
    queryKey: ['mcp-servers', JSON.stringify(mcpServerSettingsData)], // compare by value to prevent mcp server disconnects
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { tools, toolGroups } = useMemo(() => {
    const toolGroups = [
      ...(builtInTools.data ?? []),
      ...(mcpTools.data?.map((m) => m.toolGroup) ?? []),
    ];
    const tools = toolGroups.flatMap((g) => g.tools);
    return { tools, toolGroups };
  }, [builtInTools.data, mcpTools.data]);

  return { builtInTools, mcpTools, tools, toolGroups };
};
