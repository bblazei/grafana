import { DataQuery, DataTransformerConfig } from '@grafana/data';
import { DataSourceSrv } from '@grafana/runtime';

export const getDefaultCondition = () => ({
  type: 'query',
  query: { params: ['A', '5m', 'now'] },
  reducer: { type: 'avg', params: [] as any[] },
  evaluator: { type: 'gt', params: [null] as any[] },
  timeEvaluator: { type: 'any', params: [] as any[], day: 'all' },
  operator: { type: 'and' },
});

export const getAlertingValidationMessage = async (
  transformations: DataTransformerConfig[] | undefined,
  targets: DataQuery[],
  datasourceSrv: DataSourceSrv,
  datasourceName: string | null
): Promise<string> => {
  if (targets.length === 0) {
    return 'Could not find any metric queries';
  }

  if (transformations && transformations.length) {
    return 'Transformations are not supported in alert queries';
  }

  let alertingNotSupported = 0;
  let templateVariablesNotSupported = 0;

  for (const target of targets) {
    const dsName = target.datasource || datasourceName;
    const ds = await datasourceSrv.get(dsName);
    if (!ds.meta.alerting) {
      alertingNotSupported++;
    } else if (ds.targetContainsTemplate && ds.targetContainsTemplate(target)) {
      templateVariablesNotSupported++;
    }
  }

  if (alertingNotSupported === targets.length) {
    return 'The datasource does not support alerting queries';
  }

  if (templateVariablesNotSupported === targets.length) {
    return 'Template variables are not supported in alert queries';
  }

  return '';
};
