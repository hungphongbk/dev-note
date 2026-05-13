"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Select,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  Text,
  VStack,
  Card,
  CardBody,
  useBreakpointValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { NavBar } from "@/components/NavBar";
import { PROCESS_LABELS, PROCESS_COLORS, PROCESS_VALUES } from "@/lib/constants";

interface Customer {
  id: number;
  name: string;
}

interface FilmStock {
  id: number;
  name: string;
}

interface DevNoteItem {
  id: number;
  quantity: number;
  customer: Customer;
  filmStock: FilmStock;
}

interface DevNote {
  id: number;
  customer: Customer;
  items: DevNoteItem[];
  process: keyof typeof PROCESS_LABELS;
  rollCount: number;
  notes: string | null;
  createdAt: string;
  medBatchId?: number | null;
}

interface DevNoteListResponse {
  items: DevNote[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface MedBatchSummary {
  id: number;
  process: keyof typeof PROCESS_LABELS;
  createdDate: string;
  volume: "500ml" | "1l";
  devNotes: Array<{
    id: number;
    rollCount: number;
    items?: DevNoteItem[];
  }>;
}

interface MedBatchListResponse {
  items: MedBatchSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type ViewMode = "table" | "list";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRollDisplay(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function calculateEquivalentRollCountForNote(note: { rollCount: number; items?: DevNoteItem[] }) {
  const items = note.items ?? [];
  const has4x5Item = items.some((item) => /4\s*x\s*5/i.test(item.filmStock.name));
  const hasNon4x5Item = items.some((item) => !/4\s*x\s*5/i.test(item.filmStock.name));

  // Business rule: each 4x5 roll (sheet) is equivalent to half a regular roll.
  // We apply conversion on note.rollCount because historical notes may not store
  // sheet count accurately in item.quantity.
  if (has4x5Item && !hasNon4x5Item) {
    return note.rollCount * 0.5;
  }

  return note.rollCount;
}

function ProcessBadge({ process }: { process: keyof typeof PROCESS_LABELS }) {
  return (
    <Badge colorScheme={PROCESS_COLORS[process]} borderRadius="full" px={2}>
      {PROCESS_LABELS[process]}
    </Badge>
  );
}

function BatchItems({ items }: { items: DevNoteItem[] }) {
  return (
    <VStack align="stretch" spacing={1}>
      {items.map((item) => (
        <HStack key={item.id} spacing={2} align="center" flexWrap="wrap">
          <Tag size="sm" colorScheme="blue" borderRadius="full">
            {item.customer.name}
          </Tag>
          <Text fontSize="sm" color="gray.700">
            {item.filmStock.name}
          </Text>
          <Badge colorScheme="gray" borderRadius="full">
            x{item.quantity}
          </Badge>
        </HStack>
      ))}
    </VStack>
  );
}

// ─── Med Batch Modal ──────────────────────────────────────────────────────────

interface MedBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDevNote: DevNote | null;
  onSuccess: () => void;
}

function MedBatchModal({ isOpen, onClose, sourceDevNote, onSuccess }: MedBatchModalProps) {
  const [volume, setVolume] = useState<"500ml" | "1l">("500ml");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!sourceDevNote) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/med-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process: sourceDevNote.process,
          createdDate: sourceDevNote.createdAt,
          volume,
          sourceDevNoteId: sourceDevNote.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Không thể tạo mẻ thuốc");
      }

      toast({
        title: "Thành công",
        description: "Mẻ thuốc đã được tạo",
        status: "success",
        duration: 2000,
      });

      onSuccess();
      onClose();
      setVolume("500ml");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Lỗi tạo mẻ thuốc",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sourceDevNote) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Tạo mẻ thuốc mới</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontWeight="500" fontSize="sm" mb={1}>
                Quy trình
              </Text>
              <Text color="gray.600">{PROCESS_LABELS[sourceDevNote.process]}</Text>
            </Box>

            <Box>
              <Text fontWeight="500" fontSize="sm" mb={1}>
                Ngày pha
              </Text>
              <Text color="gray.600">{formatDate(sourceDevNote.createdAt)}</Text>
            </Box>

            <Box>
              <Text fontWeight="500" fontSize="sm" mb={2}>
                Dung tích
              </Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant={volume === "500ml" ? "solid" : "outline"}
                  colorScheme="brand"
                  onClick={() => setVolume("500ml")}
                >
                  500ml
                </Button>
                <Button
                  size="sm"
                  variant={volume === "1l" ? "solid" : "outline"}
                  colorScheme="brand"
                  onClick={() => setVolume("1l")}
                >
                  1l
                </Button>
              </HStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Hủy
          </Button>
          <Button colorScheme="brand" onClick={handleSubmit} isLoading={isSubmitting}>
            Lưu
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

interface ListViewProps {
  notes: DevNote[];
  onOpenMedBatchModal: (note: DevNote) => void;
  highlightedNoteIds: Set<number>;
}

function DevNoteCardWithContextMenu({
  note,
  onOpenMedBatchModal,
  isHighlighted,
}: {
  note: DevNote;
  onOpenMedBatchModal: (note: DevNote) => void;
  isHighlighted: boolean;
}) {
  const [isLongPressed, setIsLongPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPressed(true);
    }, 500);
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
  };

  const handleTouchMove = () => {
    clearLongPressTimer();
  };

  const handleTouchCancel = () => {
    clearLongPressTimer();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLongPressed(true);
  };

  return (
    <Box position="relative" key={note.id}>
      <Card
        variant="outline"
        borderRadius="xl"
        borderColor={isHighlighted ? "brand.300" : undefined}
        bg={isHighlighted ? "brand.50" : "white"}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchCancel}
        onContextMenu={handleContextMenu}
        cursor="context-menu"
      >
        <CardBody>
          <Flex justify="space-between" align="flex-start" wrap="wrap" gap={2}>
            <VStack align="flex-start" spacing={1} flex={1} width="100%">
              <HStack spacing={2} flexWrap="wrap">
                <ProcessBadge process={note.process} />
                {isHighlighted && (
                  <Badge colorScheme="brand" borderRadius="full">
                    thuộc mẻ mới nhất
                  </Badge>
                )}
                <Badge colorScheme="gray" borderRadius="full">
                  {note.rollCount} cuộn
                </Badge>
              </HStack>

              <BatchItems items={note.items} />

              {note.notes && (
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {note.notes}
                </Text>
              )}
            </VStack>

            <Text fontSize="sm" color="gray.400" whiteSpace="nowrap">
              {formatDate(note.createdAt)}
            </Text>
          </Flex>
        </CardBody>
      </Card>

      {isLongPressed && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          bg="rgba(0,0,0,0.2)"
          zIndex={999}
          onClick={() => setIsLongPressed(false)}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {isLongPressed && (
        <Box
          position="absolute"
          top="100%"
          left="0"
          mt={1}
          bg="white"
          borderRadius="lg"
          shadow="lg"
          zIndex={1000}
          minW="150px"
        >
          <Button
            width="100%"
            justifyContent="flex-start"
            variant="ghost"
            size="sm"
            onClick={() => {
              onOpenMedBatchModal(note);
              setIsLongPressed(false);
            }}
            borderRadius="0"
            _first={{ borderTopRadius: "lg" }}
            _last={{ borderBottomRadius: "lg" }}
          >
            mẻ thuốc mới...
          </Button>
        </Box>
      )}
    </Box>
  );
}

function ListView({ notes, onOpenMedBatchModal, highlightedNoteIds }: ListViewProps) {
  if (notes.length === 0) {
    return (
      <Text color="gray.400" textAlign="center" py={12}>
        Chưa có ghi chú nào.
      </Text>
    );
  }

  return (
    <VStack spacing={3} align="stretch">
      {notes.map((note) => (
        <DevNoteCardWithContextMenu
          key={note.id}
          note={note}
          onOpenMedBatchModal={onOpenMedBatchModal}
          isHighlighted={highlightedNoteIds.has(note.id)}
        />
      ))}
    </VStack>
  );
}

// ─── Table View ──────────────────────────────────────────────────────────────

function TableView({ notes, highlightedNoteIds }: { notes: DevNote[]; highlightedNoteIds: Set<number> }) {
  if (notes.length === 0) {
    return (
      <Text color="gray.400" textAlign="center" py={12}>
        Chưa có ghi chú nào.
      </Text>
    );
  }

  return (
    <Box overflowX="auto" borderRadius="xl" shadow="sm" bg="white">
      <Table variant="simple" size="sm">
        <Thead bg="gray.50">
          <Tr>
            <Th>Ngày</Th>
            <Th>Chi tiết khách - film</Th>
            <Th>Quy trình</Th>
            <Th isNumeric>Cuộn</Th>
            <Th>Ghi chú</Th>
          </Tr>
        </Thead>
        <Tbody>
          {notes.map((note) => (
            <Tr
              key={note.id}
              _hover={{ bg: highlightedNoteIds.has(note.id) ? "brand.100" : "gray.50" }}
              bg={highlightedNoteIds.has(note.id) ? "brand.50" : undefined}
            >
              <Td whiteSpace="nowrap">{formatDate(note.createdAt)}</Td>
              <Td>
                <BatchItems items={note.items} />
              </Td>
              <Td>
                <ProcessBadge process={note.process} />
              </Td>
              <Td isNumeric>{note.rollCount}</Td>
              <Td maxW="200px">
                <Text noOfLines={2} color="gray.600" fontSize="sm">
                  {note.notes ?? "—"}
                </Text>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const PAGE_SIZE = 10;
  const defaultMode = useBreakpointValue<ViewMode>({ base: "list", md: "table" }) ?? "list";
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);

  const [notes, setNotes] = useState<DevNote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [latestMedBatch, setLatestMedBatch] = useState<MedBatchSummary | null>(null);
  const [isLoadingLatestMedBatch, setIsLoadingLatestMedBatch] = useState(false);

  const [filterCustomer, setFilterCustomer] = useState<string>("");
  const [filterProcess, setFilterProcess] = useState<string>("");

  // Med Batch Modal state
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedNote, setSelectedNote] = useState<DevNote | null>(null);

  // Set default view mode once breakpoint is resolved
  useEffect(() => {
    if (viewMode === null && defaultMode) {
      setViewMode(defaultMode);
    }
  }, [defaultMode, viewMode]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCustomer) params.set("customerId", filterCustomer);
    if (filterProcess) params.set("process", filterProcess);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    const res = await fetch(`/api/dev-notes?${params}`);
    const payload = (await res.json()) as DevNoteListResponse;
    setNotes(payload.items);
    setTotal(payload.pagination.total);
    setTotalPages(payload.pagination.totalPages);
    setLoading(false);
  }, [filterCustomer, filterProcess, page]);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
  }, []);

  const fetchLatestMedBatch = useCallback(async () => {
    if (!filterProcess) {
      setLatestMedBatch(null);
      return;
    }

    setIsLoadingLatestMedBatch(true);
    try {
      const params = new URLSearchParams({
        process: filterProcess,
        page: "1",
        pageSize: "1",
      });
      const res = await fetch(`/api/med-batches?${params}`);
      if (!res.ok) {
        throw new Error("Không thể tải thông tin mẻ thuốc");
      }
      const payload = (await res.json()) as MedBatchListResponse;
      setLatestMedBatch(payload.items[0] ?? null);
    } catch {
      setLatestMedBatch(null);
    } finally {
      setIsLoadingLatestMedBatch(false);
    }
  }, [filterProcess]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchLatestMedBatch();
  }, [fetchLatestMedBatch]);

  useEffect(() => {
    setPage(1);
  }, [filterCustomer, filterProcess]);

  const handleOpenMedBatchModal = (note: DevNote) => {
    setSelectedNote(note);
    onOpen();
  };

  const handleMedBatchSuccess = () => {
    fetchNotes();
    fetchLatestMedBatch();
  };

  const highlightedNoteIds = useMemo(
    () => new Set((latestMedBatch?.devNotes ?? []).map((note) => note.id)),
    [latestMedBatch]
  );

  const latestMedBatchRollCount = useMemo(
    () =>
      (latestMedBatch?.devNotes ?? []).reduce(
        (sum, note) => sum + calculateEquivalentRollCountForNote(note),
        0
      ),
    [latestMedBatch]
  );

  const activeMode = viewMode ?? defaultMode;

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar />
      <Box maxW="6xl" mx="auto" px={4} py={8}>
        <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
          <Heading size="lg" color="brand.600">
            Nhật kí tráng film
          </Heading>

          {/* ── View toggle ── */}
          <HStack>
            <Button
              size="sm"
              variant={activeMode === "table" ? "solid" : "outline"}
              colorScheme="brand"
              onClick={() => setViewMode("table")}
            >
              Bảng
            </Button>
            <Button
              size="sm"
              variant={activeMode === "list" ? "solid" : "outline"}
              colorScheme="brand"
              onClick={() => setViewMode("list")}
            >
              Danh sách
            </Button>
          </HStack>
        </Flex>

        {/* ── Filters ───────────────────────────────────────── */}
        <HStack spacing={3} mb={6} flexWrap="wrap">
          <Select
            placeholder="Tất cả khách hàng"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            maxW="220px"
            bg="white"
            size="sm"
            borderRadius="lg"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            placeholder="Tất cả quy trình"
            value={filterProcess}
            onChange={(e) => setFilterProcess(e.target.value)}
            maxW="200px"
            bg="white"
            size="sm"
            borderRadius="lg"
          >
            {PROCESS_VALUES.map((p) => (
              <option key={p} value={p}>
                {PROCESS_LABELS[p]}
              </option>
            ))}
          </Select>

          {(filterCustomer || filterProcess) && (
            <Button
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={() => {
                setFilterCustomer("");
                setFilterProcess("");
                setPage(1);
              }}
            >
              Xóa lọc
            </Button>
          )}
        </HStack>

        {filterProcess && !isLoadingLatestMedBatch && latestMedBatch && (
          <Card mb={6} variant="outline" borderRadius="xl" borderColor="blue.200" bg="blue.50">
            <CardBody>
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between" flexWrap="wrap">
                  <Heading size="sm" color="blue.700">
                    Mẻ thuốc mới nhất
                  </Heading>
                  <Badge colorScheme="blue" borderRadius="full">
                    {PROCESS_LABELS[latestMedBatch.process]}
                  </Badge>
                </HStack>
                <HStack spacing={6} flexWrap="wrap">
                  <Box>
                    <Text fontSize="xs" color="gray.600">
                      Ngày pha
                    </Text>
                    <Text fontWeight="600">{formatDate(latestMedBatch.createdDate)}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.600">
                      Dung tích
                    </Text>
                    <Text fontWeight="600">{latestMedBatch.volume}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.600">
                      Số cuộn đã tráng
                    </Text>
                    <Text fontWeight="600">{formatRollDisplay(latestMedBatchRollCount)}</Text>
                  </Box>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* ── Content ───────────────────────────────────────── */}
        {loading ? (
          <Flex justify="center" py={16}>
            <Spinner size="xl" color="brand.500" thickness="4px" />
          </Flex>
        ) : activeMode === "table" ? (
          <TableView notes={notes} highlightedNoteIds={highlightedNoteIds} />
        ) : (
          <ListView
            notes={notes}
            onOpenMedBatchModal={handleOpenMedBatchModal}
            highlightedNoteIds={highlightedNoteIds}
          />
        )}

        <Text fontSize="sm" color="gray.400" mt={4} textAlign="right">
          {total} ghi chú
        </Text>

        <HStack justify="space-between" mt={3}>
          <Text fontSize="sm" color="gray.500">
            Trang {page}/{totalPages}
          </Text>

          <HStack>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              isDisabled={page <= 1 || loading}
            >
              Trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              isDisabled={page >= totalPages || loading}
            >
              Sau
            </Button>
          </HStack>
        </HStack>

        {/* ── Med Batch Modal ───────────────────────────────── */}
        <MedBatchModal
          isOpen={isOpen}
          onClose={onClose}
          sourceDevNote={selectedNote}
          onSuccess={handleMedBatchSuccess}
        />
      </Box>
    </Box>
  );
}