interface Customer {
  id: number;
  name: string;
}

interface FilmStock {
  id: number;
  name: string;
}

interface NewPageListPayload {
  customers: Customer[];
  filmStocks: FilmStock[];
}

const CACHE_TTL_MS = 2 * 60 * 1000;

let cachedPayload: NewPageListPayload | null = null;
let cachedAt = 0;
let inflightRequest: Promise<NewPageListPayload> | null = null;

function isCacheFresh() {
  return Boolean(cachedPayload) && Date.now() - cachedAt < CACHE_TTL_MS;
}

async function fetchNewPageLists(): Promise<NewPageListPayload> {
  const [custRes, filmRes] = await Promise.all([
    fetch("/api/customers"),
    fetch("/api/film-stocks"),
  ]);

  if (!custRes.ok || !filmRes.ok) {
    throw new Error("Khong the tai danh sach khach hang hoac film");
  }

  const [customers, filmStocks] = (await Promise.all([
    custRes.json(),
    filmRes.json(),
  ])) as [Customer[], FilmStock[]];

  return { customers, filmStocks };
}

export function preloadNewPageLists() {
  void getNewPageLists();
}

export function getCachedNewPageLists() {
  if (!isCacheFresh()) {
    return null;
  }

  return cachedPayload;
}

export async function getNewPageLists(forceRefresh = false): Promise<NewPageListPayload> {
  if (!forceRefresh && isCacheFresh() && cachedPayload) {
    return cachedPayload;
  }

  if (!forceRefresh && inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = fetchNewPageLists()
    .then((payload) => {
      cachedPayload = payload;
      cachedAt = Date.now();
      return payload;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}
