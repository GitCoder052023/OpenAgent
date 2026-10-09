import { otelIntegration } from "eve/instrumentation/otel";
import { evlogRuntimeContext } from "evlog/eve";

export default otelIntegration({ runtimeContext: evlogRuntimeContext });
