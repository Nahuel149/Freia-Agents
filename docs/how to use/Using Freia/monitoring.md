# Monitoring

Flowise has native support for Prometheus with Grafana and OpenTelemetry. However, only high-level metrics such as API requests, counts of flows/predictions are tracked. Refer [here](https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/Interface.Metrics.ts#L13) for the lists of counter metrics. For details node by node observability, we recommend using [Analytic](https://docs.flowiseai.com/using-flowise/broken-reference).

## Prometheus

[Prometheus](https://prometheus.io/) is an open-source monitoring and alerting solution.

Before setting up Prometheus, configure the following env variables in Flowise:

```properties
ENABLE_METRICS=true
METRICS_PROVIDER=prometheus
METRICS_INCLUDE_NODE_METRICS=true
```

After Prometheus is installed, run it using a configuration file. Flowise provides a default configuration file that can be found [here](https://github.com/FlowiseAI/Flowise/blob/main/metrics/prometheus/prometheus.config.yml).

Remember to have Flowise instance also running. You can open browser and navigate to port 9090. From the dashboard, you should be able to see the metric endpoint - `/api/v1/metrics` is now live.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-9e2d6224478205ab5dbd1c6870add712fc435d92%2Fimage%20(178).png?alt=media" alt=""><figcaption></figcaption></figure>

By default, `/api/v1/metrics` is available for Prometheus to pull the metrics from.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-e0f562cde9b6cbf7d64985d40acf2a8ca67ae75a%2Fimage%20(177).png?alt=media" alt="" width="563"><figcaption></figcaption></figure>

## Grafana

Prometheus collects rich metrics and provides a powerful querying language; Grafana transforms metrics into meaningful visualizations.

Grafana can be installed in various ways. Refer to the [guide](https://grafana.com/docs/grafana/latest/setup-grafana/installation/).

Grafana by default will expose port 9091:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-91e7effd072bc9a5fda55a6647ee1e370cab9e94%2Fimage%20(179).png?alt=media" alt=""><figcaption></figcaption></figure>

On the left side bar, click Add new connection, and select Prometheus:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-f655c13ddee53d69320ad2d1238c151d780b4992%2Fimage%20(180).png?alt=media" alt=""><figcaption></figcaption></figure>

Since our Prometheus is serving at port 9090:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-29e128a4df119a10774a35edeec8b561dd90e9f7%2Fimage%20(181).png?alt=media" alt=""><figcaption></figcaption></figure>

Scroll to the bottom and test the connection:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-9f1f8782933aed77340068942e519390e9fd2d07%2Fimage%20(182).png?alt=media" alt=""><figcaption></figcaption></figure>

Take note of the data source ID shown in the toolbar, we'll need this for creating dashboards:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-bb509fdb04cf39a9e44506a805d3b5350e630984%2Fimage%20(184).png?alt=media" alt=""><figcaption></figcaption></figure>

Now that connection is added successfully, we can start adding dashboard. From the left side bar, click Dashboards, and Create Dashboard.

Flowise provides 2 template dashboards:

* [grafana.dashboard.app.json.txt](https://github.com/FlowiseAI/Flowise/blob/main/metrics/grafana/grafana.dashboard.app.json.txt): API metrics such as number of chatflows/agentflows, predictions count, tools, assistant, upserted vectors, etc.
* [grafana.dashboard.server.json.txt](https://github.com/FlowiseAI/Flowise/blob/main/metrics/grafana/grafana.dashboard.server.json.txt): metrics of the Flowise node.js instance such as heap, CPU, RAM usage

If you are using templates above, find and replace all occurence of `cds4j1ybfuhogb` with the data source ID you created and saved earlier.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-8bccc4a3790bba45ffff492c71a15e4fdc588d7b%2Fimage%20(183).png?alt=media" alt=""><figcaption></figcaption></figure>

You can also choose to import first then edit the JSON later:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-3204952c44f6bcc9f77884ef1d35811d1f00dde7%2Fimage%20(185).png?alt=media" alt=""><figcaption></figcaption></figure>

Now, try to perform some actions on the Flowise, you should be able to see the metrics displayed:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-23c9f1aedfb95ced189a228375e7f5b06235a88c%2Fimage%20(186).png?alt=media" alt=""><figcaption></figcaption></figure>

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-bbd722312b8a6f3c40083546b397b40750c3f881%2Fimage%20(187).png?alt=media" alt=""><figcaption></figcaption></figure>

## OpenTelemetry

[OpenTelemetry](https://opentelemetry.io/) is an open source framework for creating and managing telemetry data. To enable OTel, configure the following env variables in Flowise:

```properties
ENABLE_METRICS=true
METRICS_PROVIDER=open_telemetry
METRICS_INCLUDE_NODE_METRICS=true
METRICS_OPEN_TELEMETRY_METRIC_ENDPOINT=http://localhost:4318/v1/metrics
METRICS_OPEN_TELEMETRY_PROTOCOL=http # http | grpc | proto (default is http)
METRICS_OPEN_TELEMETRY_DEBUG=true
```

Next, we need OpenTelemetry Collector to receive, process and export telemetry data. Flowise provides a [docker compose file](https://github.com/FlowiseAI/Flowise/blob/main/metrics/otel/compose.yaml) which can be used to start the collector container.

```bash
cd Flowise
cd metrics && cd otel
docker compose up -d
```

The collector will be using the [otel.config.yml](https://github.com/FlowiseAI/Flowise/blob/main/metrics/otel/otel.config.yml) file under the same directory for configurations. Currently only [Datadog](https://www.datadoghq.com/) and Prometheus are supported, refer to the [Open Telemetry](https://opentelemetry.io/) documentation to configure different APM tools such as Zipkin, Jeager, New Relic, Splunk and others.

Make sure to replace with the necessary API key for the exporters within the yml file.
