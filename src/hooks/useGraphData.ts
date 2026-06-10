import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useGraphData(filters?: { docIds?: string[]; types?: string[] }) {
  const params = new URLSearchParams();
  filters?.docIds?.forEach(id => params.append("docId", id));
  filters?.types?.forEach(t => params.append("type", t));

  const { data, error, isLoading, mutate } = useSWR(
    `/api/graph?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  return {
    graphData: data ?? { nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, docCount: 0, clusterCount: 0 } },
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}
