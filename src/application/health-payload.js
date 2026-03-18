export function buildHealthPayload({ bridge, channelAdapter }) {
  const channelMetrics = channelAdapter.getMetrics();
  return {
    ok: true,
    transport: channelAdapter.getTransport(),
    ...bridge.getHealth(),
    feishu: channelMetrics.feishu || null,
    reconnect: channelMetrics.reconnect || null,
    ws: channelMetrics.ws || null
  };
}
