import type { ToolGroup } from '../types/tool.ts';
import { questions } from './questions.ts';
import { skills } from './skills.ts';

export default [questions, skills] satisfies ToolGroup[];
