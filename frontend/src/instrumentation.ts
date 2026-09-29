import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const exporter = new OTLPLogExporter({
      url: 'https://us.i.posthog.com/otlp/v1/logs',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_POSTHOG_TOKEN || 'phc_oVw8Aux6BnA6QirZvuy5jPgWpoWJcU5uAqBsP98K6NXH'}`,
      },
    });

    const loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': 'manga-next',
      }),
      processors: [new SimpleLogRecordProcessor({ exporter })],
    });

    (globalThis as any).__posthogLogger = loggerProvider.getLogger('manga-next');
  }
}
