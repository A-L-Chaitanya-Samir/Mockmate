import type { CodingLanguage, CodingEvaluation } from "@/types/coding";
export interface CodingProblem {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  statement: string;
  constraints: string[];
  examples: string[];
  starters: Record<CodingLanguage, string>;
  followups: string[];
}
export const codingProblems: CodingProblem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & hash maps",
    statement:
      "Given an integer array nums and an integer target, return the indices of two distinct values whose sum equals target. Exactly one solution exists. Explain your approach before optimizing it.",
    constraints: [
      "2 ≤ nums.length ≤ 10,000",
      "Values can be negative, zero, or positive.",
      "Return distinct indices in any order.",
    ],
    examples: [
      "nums = [2, 7, 11, 15], target = 9 → [0, 1]",
      "nums = [3, 2, 4], target = 6 → [1, 2]",
      "nums = [3, 3], target = 6 → [0, 1]",
    ],
    starters: {
      JavaScript:
        "function twoSum(nums, target) {\n  // Explain your approach and implement it.\n  return [];\n}\n",
      Python:
        "def two_sum(nums, target):\n    # Explain your approach and implement it.\n    return []\n",
      Java: "class Solution {\n  public int[] twoSum(int[] nums, int target) {\n    // Implement your solution.\n    return new int[] {};\n  }\n}\n",
      "C++":
        "#include <vector>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n  // Implement your solution.\n  return {};\n}\n",
    },
    followups: [
      "Why did you choose this approach?",
      "What is its time and space complexity?",
      "Can you optimize the solution?",
      "How would you handle duplicates and negative values?",
    ],
  },
  {
    id: "balanced-brackets",
    title: "Balanced Brackets",
    difficulty: "Easy",
    category: "Strings & stacks",
    statement:
      "Given a string containing only parentheses, square brackets, and braces, determine whether every opening bracket has a matching closing bracket in the correct order. Explain the data structure you choose.",
    constraints: [
      "0 ≤ text.length ≤ 10,000",
      "Input contains only ()[]{}.",
      "An empty string is valid.",
    ],
    examples: [
      "text = '([]){}' → true",
      "text = '([)]' → false",
      "text = '' → true",
    ],
    starters: {
      JavaScript:
        "function isBalanced(text) {\n  // Explain your approach and implement it.\n  return false;\n}\n",
      Python:
        "def is_balanced(text):\n    # Explain your approach and implement it.\n    return False\n",
      Java: "class Solution {\n  public boolean isBalanced(String text) {\n    // Implement your solution.\n    return false;\n  }\n}\n",
      "C++":
        "#include <string>\nusing namespace std;\nbool isBalanced(string text) {\n  // Implement your solution.\n  return false;\n}\n",
    },
    followups: [
      "Why is a stack a good fit here?",
      "What is the worst-case time and space complexity?",
      "Can you return early for invalid input?",
      "How do you handle an empty string or an unmatched closing bracket?",
    ],
  },
];
export const sampleCodingEvaluation: CodingEvaluation = {
  notice:
    "Prewritten example only. Your code was not executed, tested, or evaluated by AI. Integrity events do not change these fixture results.",
  dimensions: [
    {
      label: "Correctness",
      feedback:
        "Sample review: validate the examples, empty or minimal input, repeated values, and invalid ordering. No test verdict is available for your submission.",
    },
    {
      label: "Approach",
      feedback:
        "Sample review: explain the invariant that makes your chosen data structure work. Compare the straightforward solution with your optimized approach.",
    },
    {
      label: "Complexity",
      feedback:
        "Sample review: discuss an O(n) approach and its O(n) worst-case extra space. State what n represents and justify each bound.",
    },
    {
      label: "Problem-solving",
      feedback:
        "Sample review: clarify assumptions, trace one example by hand, and describe edge cases before writing code.",
    },
  ],
  suggestions: [
    "State an invariant before coding.",
    "Explain time and space complexity separately.",
    "Trace an edge case aloud before submitting.",
  ],
};
