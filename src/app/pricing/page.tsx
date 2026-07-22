"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import { PriceService, Process } from "@prisma/client";
import { Select as ChakraReactSelect } from "chakra-react-select";

import { NavBar } from "@/components/NavBar";
import { PROCESS_LABELS } from "@/lib/constants";
import {
  DEFAULT_PROCESSING_PRICES,
  PRICE_PROCESS_VALUES,
  PRICE_SERVICE_LABELS,
  PRICE_SERVICE_VALUES,
  formatVnd,
} from "@/lib/pricing";

interface Customer {
  id: number;
  name: string;
}

type PriceMatrix = Record<PriceService, Record<Process, number>>;

interface PriceTableData {
  id: number;
  name: string;
  isDefault: boolean;
  customerIds: number[];
  customers: Customer[];
  prices: PriceMatrix;
}

interface CustomerOption {
  value: string;
  label: string;
}

function clonePrices(prices: PriceMatrix): PriceMatrix {
  return PRICE_SERVICE_VALUES.reduce((serviceAcc, service) => {
    serviceAcc[service] = PRICE_PROCESS_VALUES.reduce((processAcc, process) => {
      processAcc[process] = prices[service][process];
      return processAcc;
    }, {} as Record<Process, number>);
    return serviceAcc;
  }, {} as PriceMatrix);
}

export default function PricingPage() {
  const toast = useToast();
  const createModal = useDisclosure();

  const [tables, setTables] = useState<PriceTableData[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftCustomerIds, setDraftCustomerIds] = useState<number[]>([]);
  const [draftPrices, setDraftPrices] = useState<PriceMatrix>(() => clonePrices(DEFAULT_PROCESSING_PRICES));

  const [newTableName, setNewTableName] = useState("");
  const [newTableCustomerIds, setNewTableCustomerIds] = useState<number[]>([]);

  const selectedTable = tables.find((table) => table.id === selectedId) ?? null;
  const defaultTable = tables.find((table) => table.isDefault) ?? null;

  const customerOptions: CustomerOption[] = customers.map((customer) => ({
    value: String(customer.id),
    label: customer.name,
  }));

  const assignedCustomerIds = useMemo(() => {
    const ids = new Map<number, number>();
    tables.forEach((table) => {
      table.customerIds.forEach((customerId) => ids.set(customerId, table.id));
    });
    return ids;
  }, [tables]);

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/price-tables");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const payload: { tables: PriceTableData[]; customers: Customer[] } = await res.json();
      setTables(payload.tables);
      setCustomers(payload.customers);
      setSelectedId((current) => current ?? payload.tables[0]?.id ?? null);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Không thể tải bảng giá", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  useEffect(() => {
    if (!selectedTable) return;
    setDraftName(selectedTable.name);
    setDraftCustomerIds(selectedTable.customerIds);
    setDraftPrices(clonePrices(selectedTable.prices));
  }, [selectedTable]);

  const setPrice = (service: PriceService, process: Process, amount: number) => {
    setDraftPrices((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        [process]: amount,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedTable || !draftName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/price-tables/${selectedTable.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          customerIds: selectedTable.isDefault ? [] : draftCustomerIds,
          prices: draftPrices,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const updated: PriceTableData = await res.json();
      setTables((prev) => prev.map((table) => (table.id === updated.id ? updated : table)));
      toast({ title: "Đã lưu bảng giá", status: "success", duration: 2000 });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Lỗi lưu bảng giá", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setNewTableName("");
    setNewTableCustomerIds([]);
    createModal.onOpen();
  };

  const handleCreate = async () => {
    if (!newTableName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/price-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTableName.trim(),
          customerIds: newTableCustomerIds,
          prices: defaultTable?.prices ?? DEFAULT_PROCESSING_PRICES,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const created: PriceTableData = await res.json();
      setTables((prev) => [...prev, created]);
      setSelectedId(created.id);
      createModal.onClose();
      toast({ title: "Đã tạo bảng giá riêng", status: "success", duration: 2000 });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Lỗi tạo bảng giá", status: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTable || selectedTable.isDefault) return;
    if (!window.confirm(`Xoá bảng giá "${selectedTable.name}"?`)) return;

    try {
      const res = await fetch(`/api/price-tables/${selectedTable.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setTables((prev) => prev.filter((table) => table.id !== selectedTable.id));
      setSelectedId(defaultTable?.id ?? null);
      toast({ title: "Đã xoá bảng giá", status: "success", duration: 2000 });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Lỗi xoá bảng giá", status: "error" });
    }
  };

  const selectedCustomerOptions = customerOptions.filter((option) =>
    draftCustomerIds.includes(Number(option.value))
  );

  const newTableCustomerOptions = customerOptions.filter((option) =>
    newTableCustomerIds.includes(Number(option.value))
  );

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar />
      <Box maxW="6xl" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 4, md: 8 }}>
        <Flex align={{ base: "stretch", md: "center" }} justify="space-between" gap={3} mb={5} direction={{ base: "column", md: "row" }}>
          <Box>
            <Heading size={{ base: "md", md: "lg" }} color="brand.600">
              Quản lý giá tráng scan
            </Heading>
            <Text color="gray.500" fontSize="sm" mt={1}>
              Bảng mặc định áp dụng cho mọi khách chưa có bảng giá riêng.
            </Text>
          </Box>
          <Button leftIcon={<AddIcon />} colorScheme="brand" onClick={openCreateModal}>
            Thêm bảng riêng
          </Button>
        </Flex>

        <Flex align="flex-start" gap={4} direction={{ base: "column", lg: "row" }}>
          <Box w={{ base: "full", lg: "280px" }} bg="white" borderRadius="xl" shadow="sm" p={3}>
            <VStack align="stretch" spacing={2}>
              {loading ? (
                <Text color="gray.400" py={6} textAlign="center">
                  Đang tải...
                </Text>
              ) : (
                tables.map((table) => {
                  const isSelected = table.id === selectedId;
                  return (
                    <Button
                      key={table.id}
                      h="auto"
                      py={3}
                      px={3}
                      justifyContent="flex-start"
                      whiteSpace="normal"
                      variant={isSelected ? "solid" : "ghost"}
                      colorScheme={isSelected ? "brand" : undefined}
                      onClick={() => setSelectedId(table.id)}
                    >
                      <VStack align="flex-start" spacing={1}>
                        <HStack>
                          <Text fontWeight="bold">{table.name}</Text>
                          {table.isDefault && <Badge colorScheme="brand">Mặc định</Badge>}
                        </HStack>
                        {!table.isDefault && (
                          <Text fontSize="xs" color={isSelected ? "brand.50" : "gray.500"}>
                            {table.customers.length} khách
                          </Text>
                        )}
                      </VStack>
                    </Button>
                  );
                })
              )}
            </VStack>
          </Box>

          <Box flex={1} w="full" bg="white" borderRadius="xl" shadow="sm" p={{ base: 4, md: 5 }}>
            {!selectedTable ? (
              <Text color="gray.400" textAlign="center" py={12}>
                Chưa có bảng giá.
              </Text>
            ) : (
              <VStack align="stretch" spacing={5}>
                <Flex justify="space-between" gap={3} direction={{ base: "column", md: "row" }}>
                  <FormControl isRequired>
                    <FormLabel>Tên bảng giá</FormLabel>
                    <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                  </FormControl>
                  {!selectedTable.isDefault && (
                    <IconButton
                      aria-label="Xoá bảng giá"
                      icon={<DeleteIcon />}
                      colorScheme="red"
                      variant="outline"
                      alignSelf={{ base: "flex-end", md: "end" }}
                      onClick={handleDelete}
                    />
                  )}
                </Flex>

                {selectedTable.isDefault ? (
                  <Box bg="brand.50" borderRadius="lg" px={3} py={2}>
                    <Text fontSize="sm" color="brand.700">
                      Bảng này được dùng khi khách không có bảng giá riêng.
                    </Text>
                  </Box>
                ) : (
                  <FormControl>
                    <FormLabel>Khách áp dụng</FormLabel>
                    <ChakraReactSelect<CustomerOption, true>
                      isMulti
                      placeholder="Chọn khách..."
                      options={customerOptions}
                      value={selectedCustomerOptions}
                      onChange={(options) => setDraftCustomerIds(options.map((option) => Number(option.value)))}
                      isOptionDisabled={(option) => {
                        const assignedTableId = assignedCustomerIds.get(Number(option.value));
                        return Boolean(assignedTableId && assignedTableId !== selectedTable.id);
                      }}
                    />
                  </FormControl>
                )}

                <Box overflowX="auto" borderWidth="1px" borderColor="gray.100" borderRadius="lg">
                  <Table size="sm" minW="780px">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Dịch vụ</Th>
                        {PRICE_PROCESS_VALUES.map((process) => (
                          <Th key={process} textAlign="right">
                            {PROCESS_LABELS[process]}
                          </Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {PRICE_SERVICE_VALUES.map((service) => (
                        <Tr key={service}>
                          <Td fontWeight="semibold">
                            {PRICE_SERVICE_LABELS[service]}
                          </Td>
                          {PRICE_PROCESS_VALUES.map((process) => (
                            <Td key={process}>
                              <Input
                                type="number"
                                min={0}
                                size="sm"
                                textAlign="right"
                                value={draftPrices[service][process]}
                                onChange={(event) =>
                                  setPrice(service, process, Math.max(0, Math.trunc(Number(event.target.value) || 0)))
                                }
                              />
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>

                <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap={3} direction={{ base: "column", md: "row" }}>
                  <Text fontSize="sm" color="gray.500">
                    Ví dụ: Tráng scan C41 hiện là {formatVnd(draftPrices.DEVELOP_SCAN.C41)}đ.
                  </Text>
                  <Button colorScheme="brand" onClick={handleSave} isLoading={saving}>
                    Lưu bảng giá
                  </Button>
                </Flex>
              </VStack>
            )}
          </Box>
        </Flex>
      </Box>

      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Thêm bảng giá riêng</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel>Tên bảng giá</FormLabel>
                <Input
                  placeholder="vd: Bảng giá khách thân thiết"
                  value={newTableName}
                  onChange={(event) => setNewTableName(event.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Khách áp dụng</FormLabel>
                <ChakraReactSelect<CustomerOption, true>
                  isMulti
                  placeholder="Chọn khách..."
                  options={customerOptions}
                  value={newTableCustomerOptions}
                  onChange={(options) => setNewTableCustomerIds(options.map((option) => Number(option.value)))}
                  isOptionDisabled={(option) => assignedCustomerIds.has(Number(option.value))}
                />
              </FormControl>
              <Text fontSize="sm" color="gray.500">
                Bảng mới sẽ sao chép giá từ bảng mặc định, sau đó bạn có thể chỉnh từng ô.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Hủy
            </Button>
            <Button colorScheme="brand" onClick={handleCreate} isLoading={creating}>
              Tạo bảng
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
