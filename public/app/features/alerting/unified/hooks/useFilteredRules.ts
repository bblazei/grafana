import { useMemo } from 'react';

import { CombinedRuleGroup, CombinedRuleNamespace, RuleFilterState } from 'app/types/unified-alerting';
import { isCloudRulesSource } from '../utils/datasource';
import { isAlertingRule } from '../utils/rules';
import { getFiltersFromUrlParams } from '../utils/misc';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

export const useFilteredRules = (namespaces: CombinedRuleNamespace[]) => {
  const [queryParams] = useQueryParams();
  const filters = getFiltersFromUrlParams(queryParams);

  return useMemo(() => {
    if (!filters.queryString && !filters.dataSource && !filters.alertState) {
      return namespaces;
    }
    const filteredNamespaces = namespaces
      // Filter by data source
      // TODO: filter by multiple data sources for grafana-managed alerts
      .filter(({ rulesSource }) =>
        filters.dataSource && isCloudRulesSource(rulesSource) ? rulesSource.name === filters.dataSource : true
      )
      // If a namespace and group have rules that match the rules filters then keep them.
      .reduce(reduceNamespaces(filters), [] as CombinedRuleNamespace[]);
    return filteredNamespaces;
  }, [namespaces, filters]);
};

const reduceNamespaces = (filters: RuleFilterState) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groups = namespace.groups.reduce(reduceGroups(filters), [] as CombinedRuleGroup[]);

    if (groups.length) {
      namespaceAcc.push({
        ...namespace,
        groups,
      });
    }

    return namespaceAcc;
  };
};

// Reduces groups to only groups that have rules matching the filters
const reduceGroups = (filters: RuleFilterState) => {
  return (groupAcc: CombinedRuleGroup[], group: CombinedRuleGroup) => {
    const rules = group.rules.filter((rule) => {
      let shouldKeep = true;
      // Query strings can match alert name, label keys, and label values
      if (filters.queryString) {
        const normalizedQueryString = filters.queryString.toLocaleLowerCase();
        const doesNameContainsQueryString = rule.name?.toLocaleLowerCase().includes(normalizedQueryString);

        const doLabelsContainQueryString = Object.entries(rule.labels || {}).some(
          ([key, value]) =>
            key.toLocaleLowerCase().includes(normalizedQueryString) ||
            value.toLocaleLowerCase().includes(normalizedQueryString)
        );
        shouldKeep = doesNameContainsQueryString || doLabelsContainQueryString;
      }
      if (filters.alertState) {
        const matchesAlertState = Boolean(
          rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filters.alertState
        );

        shouldKeep = shouldKeep && matchesAlertState;
      }
      return shouldKeep;
    });
    // Add rules to the group that match the rule list filters
    if (rules.length) {
      groupAcc.push({
        ...group,
        rules,
      });
    }
    return groupAcc;
  };
};
