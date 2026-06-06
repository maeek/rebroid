import type {
  AutomationConditionOperator,
  AutomationValueType,
} from "../definition";

export const conditionOperators: AutomationConditionOperator[] = [
  "equals",
  "notEquals",
  "contains",
  "doesNotContain",
  "exists",
  "doesNotExist",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "matches",
  "lengthEquals",
  "lengthGreaterThan",
  "lengthLessThan",
];

export const unaryOperators = new Set<AutomationConditionOperator>([
  "exists",
  "doesNotExist",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]);

export const operatorLabels: Record<AutomationConditionOperator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  doesNotContain: "does not contain",
  exists: "exists",
  doesNotExist: "does not exist",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  isTrue: "is true",
  isFalse: "is false",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is greater than or equal to",
  lessThan: "is less than",
  lessThanOrEqual: "is less than or equal to",
  matches: "matches regex",
  lengthEquals: "length equals",
  lengthGreaterThan: "length is greater than",
  lengthLessThan: "length is less than",
};

export const operatorsForType = (
  type: AutomationValueType,
): AutomationConditionOperator[] => {
  if (type === "boolean") {
    return ["isTrue", "isFalse", "exists", "doesNotExist"];
  }
  if (type === "number") {
    return [
      "equals",
      "notEquals",
      "greaterThan",
      "greaterThanOrEqual",
      "lessThan",
      "lessThanOrEqual",
      "exists",
    ];
  }
  if (type === "array") {
    return [
      "isEmpty",
      "isNotEmpty",
      "contains",
      "lengthEquals",
      "lengthGreaterThan",
      "lengthLessThan",
      "exists",
    ];
  }
  if (type === "string") {
    return [
      "exists",
      "doesNotExist",
      "isEmpty",
      "isNotEmpty",
      "equals",
      "notEquals",
      "contains",
      "doesNotContain",
      "matches",
    ];
  }
  return ["exists", "doesNotExist", "equals", "notEquals"];
};
