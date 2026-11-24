import { validatePlan } from '@boss-rush/core';
import type { Plan, ValidationIssue } from '@boss-rush/core';

export interface PlanValidationResult {
  allIssues: ValidationIssue[];
  byPath: Map<string, string[]>;
  summary: string[];
}

export function getPlanValidation(plan: Plan): PlanValidationResult {
  let issues: ValidationIssue[] = [];
  try {
    issues = validatePlan(plan);
  } catch {
    issues = [];
  }

  const byPath = new Map<string, string[]>();
  const summary: string[] = [];

  for (const issue of issues) {
    summary.push(`${issue.path}: ${issue.message}`);
    const existing = byPath.get(issue.path) ?? [];
    existing.push(issue.message);
    byPath.set(issue.path, existing);
  }

  return { allIssues: issues, byPath, summary };
}
