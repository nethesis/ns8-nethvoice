import { useQuery } from "@tanstack/vue-query";
import { request } from "../api";
import type { DestinationPage } from "../types";

export type Destination = { id: string; name: string; number: string };

async function inventory(type: string): Promise<Destination[]> {
  const items: Destination[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page: DestinationPage = await request<DestinationPage>(
      "GET",
      "/destinations",
      undefined,
      { query: "", offset, limit: 100, type },
    );
    for (const row of page.items)
      if (row.available)
        items.push({
          id: row.id,
          name: row.name,
          number: row.id.split(":")[1],
        });
    offset = page.next_offset ?? null;
  }
  return items;
}

export function useDestinations(type: "extension" | "queue") {
  return useQuery({
    queryKey: ["destinations", "inventory", type],
    queryFn: () => inventory(type),
  });
}
