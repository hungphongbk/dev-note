"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Select,
  Spinner,
  Tag,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { AddIcon, CheckIcon, ChevronLeftIcon, DeleteIcon, DownloadIcon, EditIcon } from "@chakra-ui/icons";
import { PriceService, Process } from "@prisma/client";
import { Select as ChakraReactSelect } from "chakra-react-select";

import { NavBar } from "@/components/NavBar";
import { PROCESS_COLORS, PROCESS_LABELS } from "@/lib/constants";
import {
  DEFAULT_PROCESSING_PRICES,
  PRICE_SERVICE_LABELS,
  PRICE_SERVICE_VALUES,
  formatVnd,
} from "@/lib/pricing";

interface Customer {
  id: number;
  name: string;
}

interface CustomerOption {
  value: string;
  label: string;
}

interface FilmStock {
  id: number;
  name: string;
}

interface CandidateItem {
  id: number;
  quantity: number;
  customer: Customer;
  filmStock: FilmStock;
}

interface CandidateBatch {
  id: number;
  process: Process;
  rollCount: number;
  notes: string | null;
  createdAt: string;
  items: CandidateItem[];
}

type PriceMatrix = Record<PriceService, Record<Process, number>>;

interface PriceTableInfo {
  id: number | null;
  name: string;
  isDefault: boolean;
  prices: PriceMatrix;
}

interface InvoiceItem {
  id: number;
  devNoteItemId: number | null;
  service: PriceService;
  process: Process;
  filmStockName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  devNoteItem?: {
    id: number;
    quantity: number;
    filmStock: FilmStock;
    devNote: {
      id: number;
      process: Process;
      createdAt: string;
    };
  } | null;
}

interface Invoice {
  id: number;
  customerId: number;
  customer: Customer;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  total: number;
  items: InvoiceItem[];
}

interface InvoiceListResponse {
  items: Invoice[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface CandidateResponse {
  batches: CandidateBatch[];
  priceTable: PriceTableInfo;
  pagination: {
    skip: number;
    take: number;
    total: number;
    hasMore: boolean;
  };
}

interface DraftItem {
  devNoteItemId: number;
  service: PriceService;
  process: Process;
  filmStockName: string;
  quantity: number;
  unitPrice: number;
  batchId: number;
  batchDate: string;
}

type Mode = "list" | "create" | "edit" | "view";
type Step = 1 | 2 | 3;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(amount: number) {
  return `${formatVnd(amount)}đ`;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Không thể tạo ảnh hóa đơn"));
      }
    }, "image/png");
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = Number.POSITIVE_INFINITY,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      let fragment = "";
      for (const character of word) {
        if (ctx.measureText(`${fragment}${character}`).width > maxWidth && fragment) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      current = fragment;
    }
  }

  if (current) {
    lines.push(current);
  }

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > visibleLines.length && visibleLines.length > 0) {
    visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].replace(/\s+$/, "")}...`;
  }

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + visibleLines.length * lineHeight;
}

async function renderInvoiceA5Image(invoice: Invoice) {
  const width = 1240;
  const height = 1754;
  const margin = 88;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ canvas");
  }

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 32);
  ctx.fill();

  ctx.fillStyle = "#b85c00";
  drawRoundedRect(ctx, 44, 44, width - 88, 178, 32);
  ctx.fill();
  ctx.fillRect(44, 150, width - 88, 72);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 48px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Dev Note", margin, 122);
  ctx.font = "500 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Hóa đơn tráng scan", margin, 166);

  ctx.textAlign = "right";
  ctx.font = "700 38px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`#${invoice.id}`, width - margin, 118);
  ctx.font = "500 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(formatDate(invoice.createdAt), width - margin, 158);
  ctx.textAlign = "left";

  let y = 300;
  ctx.fillStyle = "#111827";
  ctx.font = "700 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(invoice.customer.name, margin, y);
  y += 56;

  ctx.fillStyle = "#64748b";
  ctx.font = "500 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Khách hàng", margin, y);
  y += 72;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(width - margin, y);
  ctx.stroke();
  y += 58;

  const itemLimit = invoice.items.length > 12 ? 11 : invoice.items.length;
  invoice.items.slice(0, itemLimit).forEach((item, index) => {
    const rowTop = y - 24;
    ctx.fillStyle = index % 2 === 0 ? "#fff7ed" : "#ffffff";
    drawRoundedRect(ctx, margin - 22, rowTop, width - margin * 2 + 44, 116, 18);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    drawWrappedText(ctx, item.filmStockName, margin, y + 12, 540, 34, 2);

    ctx.fillStyle = "#64748b";
    ctx.font = "500 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${PRICE_SERVICE_LABELS[item.service]} - ${PROCESS_LABELS[item.process]}`, margin, y + 76);

    ctx.textAlign = "right";
    ctx.fillStyle = "#64748b";
    ctx.font = "500 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${item.quantity} x ${formatMoney(item.unitPrice)}`, width - margin, y + 26);
    ctx.fillStyle = "#924500";
    ctx.font = "700 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(formatMoney(item.lineTotal), width - margin, y + 72);
    ctx.textAlign = "left";

    y += 134;
  });

  if (invoice.items.length > itemLimit) {
    ctx.fillStyle = "#64748b";
    ctx.font = "600 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`+ ${invoice.items.length - itemLimit} item khác`, margin, y);
    y += 54;
  }

  y += 18;
  if (invoice.notes) {
    ctx.fillStyle = "#f1f5f9";
    drawRoundedRect(ctx, margin - 22, y - 28, width - margin * 2 + 44, 130, 18);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.font = "600 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Ghi chú", margin, y);
    ctx.font = "400 23px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    drawWrappedText(ctx, invoice.notes, margin, y + 42, width - margin * 2, 30, 3);
  }

  const totalTop = height - 258;
  ctx.fillStyle = "#fdf6ec";
  drawRoundedRect(ctx, margin - 22, totalTop, width - margin * 2 + 44, 126, 24);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.font = "700 32px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Tổng cộng", margin, totalTop + 76);
  ctx.textAlign = "right";
  ctx.fillStyle = "#924500";
  ctx.font = "800 48px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(formatMoney(invoice.total), width - margin, totalTop + 80);
  ctx.textAlign = "left";

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("A5 PNG - sẵn sàng in từ iOS Share Sheet", margin, height - 104);

  return canvasToBlob(canvas);
}

function getDefaultPrice(priceTable: PriceTableInfo | null, service: PriceService, process: Process) {
  return priceTable?.prices[service]?.[process] ?? DEFAULT_PROCESSING_PRICES[service][process];
}

function ProcessBadge({ process }: { process: Process }) {
  return (
    <Badge colorScheme={PROCESS_COLORS[process]} borderRadius="full" px={2}>
      {PROCESS_LABELS[process]}
    </Badge>
  );
}

function StepPill({ index, label, active, done }: { index: Step; label: string; active: boolean; done: boolean }) {
  return (
    <HStack spacing={2} color={active || done ? "brand.700" : "gray.400"}>
      <Flex
        boxSize="26px"
        align="center"
        justify="center"
        borderRadius="full"
        bg={active || done ? "brand.500" : "gray.100"}
        color={active || done ? "white" : "gray.500"}
        fontSize="xs"
        fontWeight="bold"
      >
        {done ? <CheckIcon boxSize={3} /> : index}
      </Flex>
      <Text fontSize="xs" fontWeight="bold" display={{ base: active ? "block" : "none", sm: "block" }}>
        {label}
      </Text>
    </HStack>
  );
}

export default function InvoicesPage() {
  const toast = useToast();
  const PAGE_SIZE = 10;

  const [mode, setMode] = useState<Mode>("list");
  const [step, setStep] = useState<Step>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCustomer, setFilterCustomer] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<CandidateBatch[]>([]);
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [priceTable, setPriceTable] = useState<PriceTableInfo | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [exportingInvoiceId, setExportingInvoiceId] = useState<number | null>(null);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const isEditing = mode === "edit";
  const draftTotal = draftItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const customerOptions: CustomerOption[] = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
      })),
    [customers]
  );

  const selectedCustomerOption = customerOptions.find((option) => Number(option.value) === selectedCustomerId) ?? null;

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Không thể tải khách hàng");
      const payload: Customer[] = await res.json();
      setCustomers(payload);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Không thể tải khách hàng", status: "error" });
    }
  }, [toast]);

  const fetchInvoices = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(listPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filterCustomer) params.set("customerId", filterCustomer);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Không thể tải hóa đơn");
      }

      const payload: InvoiceListResponse = await res.json();
      setInvoices(payload.items);
      setTotalPages(payload.pagination.totalPages);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Không thể tải hóa đơn", status: "error" });
    } finally {
      setLoadingList(false);
    }
  }, [filterCustomer, listPage, toast]);

  const fetchCandidates = useCallback(
    async (customerId: number, reset = true) => {
      setLoadingCandidates(true);
      try {
        const skip = reset ? 0 : candidates.length;
        const params = new URLSearchParams({
          customerId: String(customerId),
          skip: String(skip),
          take: "10",
        });

        const res = await fetch(`/api/invoices/candidates?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Không thể tải mẻ tráng");
        }

        const payload: CandidateResponse = await res.json();
        setPriceTable(payload.priceTable);
        setCandidates((prev) => (reset ? payload.batches : [...prev, ...payload.batches]));
        setHasMoreCandidates(payload.pagination.hasMore);
      } catch (error) {
        toast({ title: error instanceof Error ? error.message : "Không thể tải mẻ tráng", status: "error" });
      } finally {
        setLoadingCandidates(false);
      }
    },
    [candidates.length, toast]
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (mode === "list") {
      fetchInvoices();
    }
  }, [fetchInvoices, mode]);

  useEffect(() => {
    if ((mode === "create" || mode === "edit") && selectedCustomerId) {
      fetchCandidates(selectedCustomerId, true);
    }
  }, [fetchCandidates, mode, selectedCustomerId]);

  const resetWizard = () => {
    setStep(1);
    setSelectedCustomerId(null);
    setCandidates([]);
    setHasMoreCandidates(false);
    setPriceTable(null);
    setDraftItems([]);
    setNotes("");
    setEditingInvoiceId(null);
    setSavedInvoice(null);
  };

  const openCreate = () => {
    resetWizard();
    setMode("create");
  };

  const closeWizard = () => {
    resetWizard();
    setMode("list");
    fetchInvoices();
  };

  const openEdit = (invoice: Invoice) => {
    resetWizard();
    setMode("edit");
    setStep(2);
    setEditingInvoiceId(invoice.id);
    setSelectedCustomerId(invoice.customer.id);
    setNotes(invoice.notes ?? "");
    setDraftItems(
      invoice.items
        .filter((item) => item.devNoteItemId)
        .map((item) => ({
          devNoteItemId: item.devNoteItemId!,
          service: item.service,
          process: item.process,
          filmStockName: item.filmStockName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batchId: item.devNoteItem?.devNote.id ?? 0,
          batchDate: item.devNoteItem?.devNote.createdAt ?? invoice.createdAt,
        }))
    );
  };

  const toggleCandidateItem = (batch: CandidateBatch, item: CandidateItem) => {
    setDraftItems((prev) => {
      if (prev.some((draft) => draft.devNoteItemId === item.id)) {
        return prev.filter((draft) => draft.devNoteItemId !== item.id);
      }

      return [
        ...prev,
        {
          devNoteItemId: item.id,
          service: PriceService.DEVELOP_SCAN,
          process: batch.process,
          filmStockName: item.filmStock.name,
          quantity: item.quantity,
          unitPrice: getDefaultPrice(priceTable, PriceService.DEVELOP_SCAN, batch.process),
          batchId: batch.id,
          batchDate: batch.createdAt,
        },
      ];
    });
  };

  const updateDraftService = (devNoteItemId: number, service: PriceService) => {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.devNoteItemId === devNoteItemId
          ? {
              ...item,
              service,
              unitPrice: getDefaultPrice(priceTable, service, item.process),
            }
          : item
      )
    );
  };

  const updateDraftPrice = (devNoteItemId: number, unitPrice: number) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.devNoteItemId === devNoteItemId ? { ...item, unitPrice } : item))
    );
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Xóa hóa đơn #${invoice.id} của ${invoice.customer.name}?`)) return;

    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Không thể xóa hóa đơn");
      }

      toast({ title: "Đã xóa hóa đơn", status: "success", duration: 1800 });
      fetchInvoices();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Không thể xóa hóa đơn", status: "error" });
    }
  };

  const exportInvoiceImage = async (invoice: Invoice) => {
    setExportingInvoiceId(invoice.id);
    try {
      const blob = await renderInvoiceA5Image(invoice);
      const fileName = `dev-note-invoice-${invoice.id}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Hóa đơn #${invoice.id}`,
          text: `Hóa đơn tráng scan của ${invoice.customer.name}`,
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");

      if (!opened) {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast({ title: error instanceof Error ? error.message : "Không thể xuất ảnh hóa đơn", status: "error" });
    } finally {
      setExportingInvoiceId(null);
    }
  };

  const saveInvoice = async () => {
    if (!selectedCustomerId || draftItems.length === 0) {
      toast({ title: "Chọn khách và ít nhất một item", status: "warning" });
      return;
    }

    setSaving(true);
    try {
      const url = editingInvoiceId ? `/api/invoices/${editingInvoiceId}` : "/api/invoices";
      const res = await fetch(url, {
        method: editingInvoiceId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          notes,
          items: draftItems.map((item) => ({
            devNoteItemId: item.devNoteItemId,
            service: item.service,
            unitPrice: item.unitPrice,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Không thể lưu hóa đơn");
      }

      const invoice: Invoice = await res.json();
      setSavedInvoice(invoice);
      setMode("view");
      toast({ title: editingInvoiceId ? "Đã cập nhật hóa đơn" : "Đã tạo hóa đơn", status: "success", duration: 1800 });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Không thể lưu hóa đơn", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const renderInvoiceSummary = (invoice: Invoice) => (
    <VStack align="stretch" spacing={3}>
      <Flex justify="space-between" align="flex-start" gap={3}>
        <Box>
          <Text fontSize="sm" color="gray.500">
            Hóa đơn #{invoice.id}
          </Text>
          <Heading size="md" color="gray.900">
            {invoice.customer.name}
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            {formatDate(invoice.createdAt)}
          </Text>
        </Box>
        <Text color="brand.600" fontWeight="bold" fontSize="xl">
          {formatMoney(invoice.total)}
        </Text>
      </Flex>

      <Divider />

      {invoice.items.map((item) => (
        <Box key={item.id} borderWidth="1px" borderColor="gray.100" borderRadius="lg" p={3}>
          <Flex justify="space-between" gap={3} align="flex-start">
            <Box>
              <HStack spacing={2} flexWrap="wrap">
                <ProcessBadge process={item.process} />
                <Badge colorScheme="brand" borderRadius="full">
                  {PRICE_SERVICE_LABELS[item.service]}
                </Badge>
              </HStack>
              <Text fontWeight="bold" mt={2}>
                {item.filmStockName}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {item.quantity} cuộn x {formatMoney(item.unitPrice)}
              </Text>
            </Box>
            <Text fontWeight="bold" whiteSpace="nowrap">
              {formatMoney(item.lineTotal)}
            </Text>
          </Flex>
        </Box>
      ))}

      {invoice.notes && (
        <Box bg="gray.50" borderRadius="lg" p={3}>
          <Text fontSize="sm" color="gray.600">
            {invoice.notes}
          </Text>
        </Box>
      )}
    </VStack>
  );

  if (mode === "view" && savedInvoice) {
    return (
      <Box minH="100vh" bg="gray.50">
        <NavBar />
        <Box maxW="3xl" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 4, md: 8 }}>
          <Flex justify="space-between" align="center" gap={3} mb={3}>
            <Button leftIcon={<ChevronLeftIcon />} variant="ghost" colorScheme="brand" onClick={closeWizard}>
              Danh sách
            </Button>
            <Button
              leftIcon={<DownloadIcon />}
              colorScheme="brand"
              variant="outline"
              onClick={() => exportInvoiceImage(savedInvoice)}
              isLoading={exportingInvoiceId === savedInvoice.id}
            >
              Xuất ảnh A5
            </Button>
          </Flex>
          <Box bg="white" borderRadius="xl" shadow="sm" p={{ base: 4, md: 6 }}>
            {renderInvoiceSummary(savedInvoice)}
          </Box>
        </Box>
      </Box>
    );
  }

  if (mode === "create" || mode === "edit") {
    return (
      <Box minH="100vh" bg="gray.50">
        <NavBar />
        <Box maxW="3xl" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 3, md: 8 }}>
          <Flex align="center" justify="space-between" mb={3}>
            <IconButton
              aria-label="Quay lại"
              icon={<ChevronLeftIcon />}
              variant="ghost"
              colorScheme="brand"
              onClick={step === 1 ? closeWizard : () => setStep((prev) => (prev - 1) as Step)}
            />
            <HStack spacing={{ base: 3, sm: 5 }}>
              <StepPill index={1} label="Chọn mẻ" active={step === 1} done={step > 1} />
              <StepPill index={2} label="Gán giá" active={step === 2} done={step > 2} />
              <StepPill index={3} label="Lưu" active={step === 3} done={false} />
            </HStack>
            <Box boxSize="40px" />
          </Flex>

          <Box bg="white" borderRadius="xl" shadow="sm" p={{ base: 4, md: 6 }}>
            {step === 1 && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Heading size="md" color="brand.700">
                    {isEditing ? "Thêm item vào hóa đơn" : "Tạo hóa đơn tráng"}
                  </Heading>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Chọn khách, rồi chọn các film từ những mẻ tráng gần đây.
                  </Text>
                </Box>

                <FormControl isRequired>
                  <FormLabel>Khách hàng</FormLabel>
                  <ChakraReactSelect<CustomerOption, false>
                    placeholder="Chọn khách..."
                    options={customerOptions}
                    value={selectedCustomerOption}
                    isDisabled={isEditing}
                    onChange={(option) => {
                      setSelectedCustomerId(option ? Number(option.value) : null);
                      setDraftItems([]);
                      setCandidates([]);
                    }}
                  />
                </FormControl>

                {selectedCustomerId && (
                  <Box bg="brand.50" borderRadius="lg" px={3} py={2}>
                    <Text fontSize="sm" color="brand.700">
                      Đang dùng {priceTable?.name ?? "bảng giá mặc định"} để gợi ý giá.
                    </Text>
                  </Box>
                )}

                <VStack align="stretch" spacing={3}>
                  {loadingCandidates && candidates.length === 0 ? (
                    <Flex py={8} justify="center">
                      <Spinner color="brand.500" />
                    </Flex>
                  ) : (
                    candidates.map((batch) => (
                      <Box key={batch.id} borderWidth="1px" borderColor="gray.100" borderRadius="lg" p={3}>
                        <Flex justify="space-between" align="center" mb={3} gap={3}>
                          <HStack spacing={2} flexWrap="wrap">
                            <ProcessBadge process={batch.process} />
                            <Tag size="sm" borderRadius="full">
                              Mẻ #{batch.id}
                            </Tag>
                          </HStack>
                          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
                            {formatDate(batch.createdAt)}
                          </Text>
                        </Flex>

                        <VStack align="stretch" spacing={2}>
                          {batch.items.map((item) => {
                            const checked = draftItems.some((draft) => draft.devNoteItemId === item.id);

                            return (
                              <Button
                                key={item.id}
                                h="auto"
                                minH="58px"
                                p={3}
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor={checked ? "brand.400" : "gray.100"}
                                bg={checked ? "brand.50" : "white"}
                                variant="ghost"
                                justifyContent="space-between"
                                onClick={() => toggleCandidateItem(batch, item)}
                                whiteSpace="normal"
                              >
                                <Box textAlign="left">
                                  <Text fontWeight="bold" color="gray.900" lineHeight="1.25">
                                    {item.filmStock.name}
                                  </Text>
                                  <Text fontSize="sm" color="gray.500">
                                    {item.quantity} cuộn
                                  </Text>
                                </Box>
                                <Flex
                                  boxSize="28px"
                                  align="center"
                                  justify="center"
                                  borderRadius="full"
                                  borderWidth="1px"
                                  borderColor={checked ? "brand.500" : "gray.200"}
                                  bg={checked ? "brand.500" : "white"}
                                  color={checked ? "white" : "gray.300"}
                                  flexShrink={0}
                                >
                                  {checked && <CheckIcon boxSize={3} />}
                                </Flex>
                              </Button>
                            );
                          })}
                        </VStack>
                      </Box>
                    ))
                  )}

                  {selectedCustomerId && candidates.length === 0 && !loadingCandidates && (
                    <Text color="gray.400" textAlign="center" py={8}>
                      Khách này chưa có mẻ tráng nào.
                    </Text>
                  )}

                  {hasMoreCandidates && (
                    <Button variant="outline" colorScheme="brand" onClick={() => fetchCandidates(selectedCustomerId!, false)} isLoading={loadingCandidates}>
                      Xem thêm
                    </Button>
                  )}
                </VStack>

                <Button
                  colorScheme="brand"
                  size="lg"
                  isDisabled={!selectedCustomerId || draftItems.length === 0}
                  onClick={() => setStep(2)}
                >
                  Tiếp tục ({draftItems.length})
                </Button>
              </VStack>
            )}

            {step === 2 && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Heading size="md" color="brand.700">
                    Gán đầu mục bảng giá
                  </Heading>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Giá được tự điền, nhưng bạn có thể sửa từng dòng trước khi lưu.
                  </Text>
                </Box>

                <VStack align="stretch" spacing={3}>
                  {draftItems.map((item) => (
                    <Box key={item.devNoteItemId} borderWidth="1px" borderColor="gray.100" borderRadius="lg" p={3}>
                      <Flex justify="space-between" align="flex-start" gap={3} mb={3}>
                        <Box>
                          <HStack spacing={2} flexWrap="wrap">
                            <ProcessBadge process={item.process} />
                            <Tag size="sm" borderRadius="full">
                              Mẻ #{item.batchId || "cũ"}
                            </Tag>
                          </HStack>
                          <Text fontWeight="bold" mt={2}>
                            {item.filmStockName}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {item.quantity} cuộn, {formatDate(item.batchDate)}
                          </Text>
                        </Box>
                        <IconButton
                          aria-label="Xóa item"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => setDraftItems((prev) => prev.filter((draft) => draft.devNoteItemId !== item.devNoteItemId))}
                        />
                      </Flex>

                      <Flex gap={3} direction={{ base: "column", sm: "row" }}>
                        <FormControl>
                          <FormLabel fontSize="sm">Đầu mục</FormLabel>
                          <Select
                            value={item.service}
                            onChange={(event) => updateDraftService(item.devNoteItemId, event.target.value as PriceService)}
                          >
                            {PRICE_SERVICE_VALUES.map((service) => (
                              <option key={service} value={service}>
                                {PRICE_SERVICE_LABELS[service]}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="sm">Đơn giá</FormLabel>
                          <Input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateDraftPrice(item.devNoteItemId, Math.max(0, Math.trunc(Number(event.target.value) || 0)))
                            }
                          />
                        </FormControl>
                      </Flex>

                      <Flex justify="space-between" mt={3} fontSize="sm">
                        <Text color="gray.500">Thành tiền</Text>
                        <Text fontWeight="bold" color="brand.700">
                          {formatMoney(item.unitPrice * item.quantity)}
                        </Text>
                      </Flex>
                    </Box>
                  ))}
                </VStack>

                <Button variant="outline" colorScheme="brand" leftIcon={<AddIcon />} onClick={() => setStep(1)}>
                  Thêm item
                </Button>
                <Button colorScheme="brand" size="lg" isDisabled={draftItems.length === 0} onClick={() => setStep(3)}>
                  Xem hóa đơn tạm tính
                </Button>
              </VStack>
            )}

            {step === 3 && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Heading size="md" color="brand.700">
                    Kiểm tra hóa đơn
                  </Heading>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    {selectedCustomer?.name}
                  </Text>
                </Box>

                <VStack align="stretch" spacing={3}>
                  {draftItems.map((item) => (
                    <Flex key={item.devNoteItemId} justify="space-between" gap={3} borderBottomWidth="1px" borderColor="gray.100" pb={3}>
                      <Box>
                        <Text fontWeight="bold">{item.filmStockName}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {PRICE_SERVICE_LABELS[item.service]} - {item.quantity} x {formatMoney(item.unitPrice)}
                        </Text>
                      </Box>
                      <Text fontWeight="bold" whiteSpace="nowrap">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </Text>
                    </Flex>
                  ))}
                </VStack>

                <FormControl>
                  <FormLabel>Ghi chú</FormLabel>
                  <Textarea
                    placeholder="Ghi chú hóa đơn (tùy chọn)..."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </FormControl>

                <Flex justify="space-between" align="center" bg="brand.50" borderRadius="lg" px={3} py={3}>
                  <Text fontWeight="bold">Tổng cộng</Text>
                  <Text color="brand.700" fontWeight="bold" fontSize="2xl">
                    {formatMoney(draftTotal)}
                  </Text>
                </Flex>

                <Button colorScheme="brand" size="lg" onClick={saveInvoice} isLoading={saving}>
                  Lưu hóa đơn
                </Button>
              </VStack>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar />
      <Box maxW="6xl" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 4, md: 8 }}>
        <Flex align={{ base: "stretch", md: "center" }} justify="space-between" gap={3} mb={5} direction={{ base: "column", md: "row" }}>
          <Box>
            <Heading size={{ base: "md", md: "lg" }} color="brand.600">
              Quản lý hóa đơn tráng
            </Heading>
            <Text color="gray.500" fontSize="sm" mt={1}>
              Tạo hóa đơn từ các mẻ tráng đã ghi nhận.
            </Text>
          </Box>
          <Button leftIcon={<AddIcon />} colorScheme="brand" onClick={openCreate}>
            Tạo hóa đơn
          </Button>
        </Flex>

        <Box bg="white" borderRadius="xl" shadow="sm" p={{ base: 3, md: 4 }} mb={4}>
          <Flex gap={3} align={{ base: "stretch", md: "end" }} direction={{ base: "column", md: "row" }}>
            <FormControl>
              <FormLabel>Lọc khách</FormLabel>
              <Select
                value={filterCustomer}
                onChange={(event) => {
                  setFilterCustomer(event.target.value);
                  setListPage(1);
                }}
              >
                <option value="">Tất cả khách</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          </Flex>
        </Box>

        {loadingList ? (
          <Flex py={16} justify="center">
            <Spinner color="brand.500" />
          </Flex>
        ) : invoices.length === 0 ? (
          <Box bg="white" borderRadius="xl" shadow="sm" p={8} textAlign="center">
            <Text color="gray.400">Chưa có hóa đơn nào.</Text>
          </Box>
        ) : (
          <VStack align="stretch" spacing={3}>
            {invoices.map((invoice) => (
              <Box key={invoice.id} bg="white" borderRadius="xl" shadow="sm" p={{ base: 4, md: 5 }}>
                <Flex justify="space-between" align="flex-start" gap={3}>
                  <Box flex={1}>
                    <HStack spacing={2} flexWrap="wrap">
                      <Badge colorScheme="brand" borderRadius="full">
                        #{invoice.id}
                      </Badge>
                      <Text fontWeight="bold">{invoice.customer.name}</Text>
                      <Text fontSize="sm" color="gray.500">
                        {formatDate(invoice.createdAt)}
                      </Text>
                    </HStack>
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      {invoice.items.length} item
                    </Text>
                  </Box>

                  <VStack align="flex-end" spacing={2}>
                    <Text color="brand.700" fontWeight="bold" fontSize={{ base: "lg", md: "xl" }}>
                      {formatMoney(invoice.total)}
                    </Text>
                    <HStack>
                      <IconButton
                        aria-label="Xuất ảnh A5"
                        icon={<DownloadIcon />}
                        size="sm"
                        variant="outline"
                        colorScheme="brand"
                        onClick={() => exportInvoiceImage(invoice)}
                        isLoading={exportingInvoiceId === invoice.id}
                      />
                      <IconButton
                        aria-label="Sửa hóa đơn"
                        icon={<EditIcon />}
                        size="sm"
                        variant="outline"
                        colorScheme="brand"
                        onClick={() => openEdit(invoice)}
                      />
                      <IconButton
                        aria-label="Xóa hóa đơn"
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        onClick={() => handleDeleteInvoice(invoice)}
                      />
                    </HStack>
                  </VStack>
                </Flex>
              </Box>
            ))}
          </VStack>
        )}

        <Flex justify="center" gap={3} mt={5}>
          <Button variant="outline" isDisabled={listPage <= 1} onClick={() => setListPage((prev) => Math.max(1, prev - 1))}>
            Trước
          </Button>
          <Button variant="outline" isDisabled={listPage >= totalPages} onClick={() => setListPage((prev) => prev + 1)}>
            Sau
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
