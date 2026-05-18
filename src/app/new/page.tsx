"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Text,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  VStack,
  useToast,
  Heading,
  Divider,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  List,
  ListItem,
  useBreakpointValue,
  Badge,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { useRouter } from "next/navigation";
import { Select as ChakraReactSelect } from "chakra-react-select";
import { NavBar } from "@/components/NavBar";
import { PROCESS_LABELS, PROCESS_VALUES } from "@/lib/constants";
import { getCachedNewPageLists, getNewPageLists } from "@/lib/newPageListPreload";

interface Customer {
  id: number;
  name: string;
}

interface FilmStock {
  id: number;
  name: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface DevNoteItemInput {
  key: string;
  customerId: string;
  filmStockId: string;
  quantity: number;
}

type Process = keyof typeof PROCESS_LABELS;

function createEmptyItem(): DevNoteItemInput {
  return {
    key: `${Date.now()}-${Math.random()}`,
    customerId: "",
    filmStockId: "",
    quantity: 1,
  };
}

export default function NewDevNotePage() {
  const router = useRouter();
  const toast = useToast();
  const customerModal = useDisclosure();
  const filmModal = useDisclosure();
  const drawerDisclosure = useDisclosure();

  const isMobile = useBreakpointValue({ base: true, md: false });

  const [drawerState, setDrawerState] = useState<{ type: "customer" | "film"; itemKey: string } | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerBrand, setDrawerBrand] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filmStocks, setFilmStocks] = useState<FilmStock[]>([]);

  const [items, setItems] = useState<DevNoteItemInput[]>([createEmptyItem()]);
  const [process, setProcess] = useState<Process | "">("");
  const [rollCount, setRollCount] = useState<number>(1);
  const [rollCountTouched, setRollCountTouched] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [newFilmName, setNewFilmName] = useState("");
  const [addingFilm, setAddingFilm] = useState(false);

  const fetchData = useCallback(async () => {
    const payload = await getNewPageLists();
    setCustomers(payload.customers);
    setFilmStocks(payload.filmStocks);
  }, []);

  useEffect(() => {
    const cachedPayload = getCachedNewPageLists();

    if (cachedPayload) {
      setCustomers(cachedPayload.customers);
      setFilmStocks(cachedPayload.filmStocks);
    }

    fetchData();
  }, [fetchData]);

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    setAddingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const created: Customer = await res.json();
      setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setItems((prev) => {
        const targetIndex = prev.findIndex((item) => !item.customerId);
        if (targetIndex < 0) {
          return prev;
        }

        const next = [...prev];
        next[targetIndex] = { ...next[targetIndex], customerId: String(created.id) };
        return next;
      });
      setNewCustomerName("");
      customerModal.onClose();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Lỗi", status: "error", duration: 3000 });
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleAddFilmStock = async () => {
    if (!newFilmName.trim()) return;
    setAddingFilm(true);
    try {
      const res = await fetch("/api/film-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFilmName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const created: FilmStock = await res.json();
      setFilmStocks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setItems((prev) => {
        const targetIndex = prev.findIndex((item) => !item.filmStockId);
        if (targetIndex < 0) {
          return prev;
        }

        const next = [...prev];
        next[targetIndex] = { ...next[targetIndex], filmStockId: String(created.id) };
        return next;
      });
      setNewFilmName("");
      filmModal.onClose();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Lỗi", status: "error", duration: 3000 });
    } finally {
      setAddingFilm(false);
    }
  };

  const customerOptions: SelectOption[] = customers.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const filmOptions: SelectOption[] = filmStocks.map((film) => ({
    value: String(film.id),
    label: film.name,
  }));

  const openMobileDrawer = (type: "customer" | "film", itemKey: string) => {
    setDrawerState({ type, itemKey });
    setDrawerSearch("");
    setDrawerBrand(null);
    drawerDisclosure.onOpen();
  };

  const handleDrawerSelect = (value: string) => {
    if (!drawerState) return;
    if (drawerState.type === "customer") {
      handleUpdateItem(drawerState.itemKey, { customerId: value });
    } else {
      handleUpdateItem(drawerState.itemKey, { filmStockId: value });
    }
    drawerDisclosure.onClose();
  };

  const handleDrawerClear = () => {
    if (!drawerState) return;
    if (drawerState.type === "customer") {
      handleUpdateItem(drawerState.itemKey, { customerId: "" });
    } else {
      handleUpdateItem(drawerState.itemKey, { filmStockId: "" });
    }
    drawerDisclosure.onClose();
  };

  const processOptions: SelectOption[] = PROCESS_VALUES.map((p) => ({
    value: p,
    label: PROCESS_LABELS[p],
  }));

  const selectedProcessOption =
    processOptions.find((option) => option.value === process) ?? null;

  const autoRollCount = items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0);

  useEffect(() => {
    if (!rollCountTouched) {
      setRollCount(Math.max(1, autoRollCount || 1));
    }
  }, [autoRollCount, rollCountTouched]);

  const handleUpdateItem = (key: string, patch: Partial<DevNoteItemInput>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (key: string) => {
    setItems((prev) => {
      if (prev.length === 1) {
        return [createEmptyItem()];
      }
      return prev.filter((item) => item.key !== key);
    });
  };

  const handleSubmit = async () => {
    const hasInvalidRow = items.some(
      (item) => !item.customerId || !item.filmStockId || !Number.isInteger(item.quantity) || item.quantity < 1
    );

    if (hasInvalidRow) {
      toast({ title: "Vui lòng điền đầy đủ khách, film và số lượng cho từng dòng", status: "warning", duration: 3000 });
      return;
    }

    if (!process) {
      toast({ title: "Vui lòng chọn quy trình", status: "warning", duration: 3000 });
      return;
    }

    const payloadItems = items.map((item) => ({
      customerId: parseInt(item.customerId),
      filmStockId: parseInt(item.filmStockId),
      quantity: item.quantity,
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/dev-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          process,
          rollCount,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast({ title: "Đã thêm ghi chú thành công!", status: "success", duration: 3000 });
      router.push("/log");
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Lỗi khi lưu", status: "error", duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar />
      <Box maxW="4xl" mx="auto" px={4} py={8}>
        <Heading size="lg" mb={6} color="brand.600">
          Thêm ghi chú tráng film
        </Heading>

        <VStack spacing={6} align="stretch" bg="white" p={6} borderRadius="xl" shadow="sm">
          <FormControl isRequired>
            <FormLabel fontWeight="semibold">Danh sách film của từng khách</FormLabel>

            <VStack align="stretch" spacing={3}>
              {items.map((item, index) => (
                <Box key={item.key} borderWidth="1px" borderColor="gray.100" borderRadius="lg" p={3}>
                  <HStack align="flex-end" spacing={2} flexWrap="wrap">
                    <Box minW="220px" flex={1}>
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        Khách hàng
                      </Text>
                      <HStack align="stretch">
                        <Box flex={1}>
                          {isMobile ? (
                            <Button
                              w="full"
                              variant="outline"
                              justifyContent="flex-start"
                              fontWeight="normal"
                              color={item.customerId ? "inherit" : "gray.400"}
                              rightIcon={
                                item.customerId ? (
                                  <CloseIcon
                                    boxSize={2.5}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateItem(item.key, { customerId: "" });
                                    }}
                                  />
                                ) : undefined
                              }
                              onClick={() => openMobileDrawer("customer", item.key)}
                            >
                              {item.customerId
                                ? customers.find((c) => String(c.id) === item.customerId)?.name ?? "Chọn khách hàng..."
                                : "Chọn khách hàng..."}
                            </Button>
                          ) : (
                            <ChakraReactSelect<SelectOption, false>
                              placeholder="Chọn khách hàng..."
                              options={customerOptions}
                              value={customerOptions.find((option) => option.value === item.customerId) ?? null}
                              onChange={(option) => handleUpdateItem(item.key, { customerId: option?.value ?? "" })}
                              isClearable
                            />
                          )}
                        </Box>
                        <IconButton
                          aria-label="Thêm khách mới"
                          icon={<AddIcon />}
                          colorScheme="brand"
                          variant="outline"
                          onClick={customerModal.onOpen}
                        />
                      </HStack>
                    </Box>

                    <Box minW="220px" flex={1}>
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        Film
                      </Text>
                      <HStack align="stretch">
                        <Box flex={1}>
                          {isMobile ? (
                            <Button
                              w="full"
                              variant="outline"
                              justifyContent="flex-start"
                              fontWeight="normal"
                              color={item.filmStockId ? "inherit" : "gray.400"}
                              rightIcon={
                                item.filmStockId ? (
                                  <CloseIcon
                                    boxSize={2.5}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateItem(item.key, { filmStockId: "" });
                                    }}
                                  />
                                ) : undefined
                              }
                              onClick={() => openMobileDrawer("film", item.key)}
                            >
                              {item.filmStockId
                                ? filmStocks.find((f) => String(f.id) === item.filmStockId)?.name ?? "Chọn film..."
                                : "Chọn film..."}
                            </Button>
                          ) : (
                            <ChakraReactSelect<SelectOption, false>
                              placeholder="Chọn film..."
                              options={filmOptions}
                              value={filmOptions.find((option) => option.value === item.filmStockId) ?? null}
                              onChange={(option) => handleUpdateItem(item.key, { filmStockId: option?.value ?? "" })}
                              isClearable
                            />
                          )}
                        </Box>
                        <IconButton
                          aria-label="Thêm film mới"
                          icon={<AddIcon />}
                          colorScheme="brand"
                          variant="outline"
                          onClick={filmModal.onOpen}
                        />
                      </HStack>
                    </Box>

                    <Box minW="120px">
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        Số cuộn
                      </Text>
                      <NumberInput
                        min={1}
                        max={999}
                        value={item.quantity}
                        onChange={(_, val) =>
                          handleUpdateItem(item.key, { quantity: isNaN(val) ? 1 : Math.max(1, Math.trunc(val)) })
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Box>

                    <IconButton
                      aria-label={`Xóa dòng film ${index + 1}`}
                      icon={<DeleteIcon />}
                      onClick={() => handleRemoveItem(item.key)}
                      colorScheme="red"
                      variant="ghost"
                    />
                  </HStack>
                </Box>
              ))}
            </VStack>

            <Button mt={3} leftIcon={<AddIcon />} variant="outline" colorScheme="brand" onClick={handleAddItem}>
              Thêm dòng film
            </Button>
          </FormControl>

          <Divider />

          <FormControl isRequired>
            <FormLabel fontWeight="semibold">Quy trình</FormLabel>
            <ChakraReactSelect<SelectOption, false>
              placeholder="Chọn quy trình..."
              options={processOptions}
              value={selectedProcessOption}
              onChange={(option) => setProcess((option?.value as Process | undefined) ?? "")}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel fontWeight="semibold">Số lượng cuộn</FormLabel>
            <HStack align="center" spacing={3} flexWrap="wrap">
              <NumberInput
                min={1}
                max={999}
                value={rollCount}
                onChange={(_, val) => {
                  setRollCount(isNaN(val) ? 1 : Math.max(1, Math.trunc(val)));
                  setRollCountTouched(true);
                }}
                maxW="140px"
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRollCount(Math.max(1, autoRollCount || 1));
                  setRollCountTouched(false);
                }}
              >
                Tự động điền theo danh sách
              </Button>

              <Text fontSize="sm" color="gray.500">
                Gợi ý: {Math.max(1, autoRollCount || 1)} cuộn
              </Text>
            </HStack>
          </FormControl>

          <FormControl>
            <FormLabel fontWeight="semibold">Ghi chú</FormLabel>
            <Textarea
              placeholder="Ghi chú thêm (tuỳ chọn)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              resize="vertical"
            />
          </FormControl>

          <Flex justify="flex-end" pt={2}>
            <Button
              colorScheme="brand"
              size="lg"
              px={8}
              onClick={handleSubmit}
              isLoading={submitting}
              loadingText="Đang lưu..."
            >
              Lưu ghi chú
            </Button>
          </Flex>
        </VStack>
      </Box>

      <Modal isOpen={customerModal.isOpen} onClose={customerModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Thêm khách mới</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Tên khách mới"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={customerModal.onClose}>
              Hủy
            </Button>
            <Button colorScheme="brand" onClick={handleAddCustomer} isLoading={addingCustomer}>
              Thêm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={filmModal.isOpen} onClose={filmModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Thêm film mới</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Tên film mới (vd: Kodak Gold 200)"
              value={newFilmName}
              onChange={(e) => setNewFilmName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddFilmStock()}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={filmModal.onClose}>
              Hủy
            </Button>
            <Button colorScheme="brand" onClick={handleAddFilmStock} isLoading={addingFilm}>
              Thêm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Mobile bottom drawer for selecting customer / film */}
      <Drawer
        isOpen={drawerDisclosure.isOpen}
        placement="bottom"
        onClose={drawerDisclosure.onClose}
      >
        <DrawerOverlay />
        <DrawerContent borderTopRadius="xl" maxH="70vh">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" pb={3}>
            <Flex align="center" gap={2}>
              {drawerState?.type === "customer" ? "Chọn khách hàng" : "Chọn film"}
              {drawerState && (
                (() => {
                  const options = drawerState.type === "customer" ? customerOptions : filmOptions;
                  const currentValue = drawerState.type === "customer"
                    ? items.find((i) => i.key === drawerState.itemKey)?.customerId
                    : items.find((i) => i.key === drawerState.itemKey)?.filmStockId;
                  const current = options.find((o) => o.value === currentValue);
                  return current ? (
                    <Badge colorScheme="brand" fontWeight="normal" fontSize="sm">
                      {current.label}
                    </Badge>
                  ) : null;
                })()
              )}
            </Flex>
          </DrawerHeader>
          <DrawerBody pb={6} overflowY="auto">
            <InputGroup mb={3} mt={1}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Tìm kiếm..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                autoFocus
              />
            </InputGroup>

            {(() => {
              const options = drawerState?.type === "customer" ? customerOptions : filmOptions;

              // Brand filter chips — only for film drawer
              const brands = drawerState?.type === "film"
                ? Array.from(new Set(filmOptions.map((o) => o.label.split(" ")[0]))).sort()
                : [];

              const filtered = options.filter((o) => {
                const matchesSearch = o.label.toLowerCase().includes(drawerSearch.toLowerCase());
                const matchesBrand = drawerState?.type !== "film" || !drawerBrand || o.label.startsWith(drawerBrand);
                return matchesSearch && matchesBrand;
              });
              const currentValue = drawerState
                ? drawerState.type === "customer"
                  ? items.find((i) => i.key === drawerState.itemKey)?.customerId
                  : items.find((i) => i.key === drawerState.itemKey)?.filmStockId
                : undefined;

              return (
                <>
                  {brands.length > 1 && (
                    <Wrap spacing={2} mb={3}>
                      {brands.map((brand) => (
                        <WrapItem key={brand}>
                          <Button
                            size="sm"
                            borderRadius="full"
                            variant={drawerBrand === brand ? "solid" : "outline"}
                            colorScheme="brand"
                            onClick={() => setDrawerBrand((prev) => (prev === brand ? null : brand))}
                          >
                            {brand}
                          </Button>
                        </WrapItem>
                      ))}
                    </Wrap>
                  )}
                  <List spacing={1}>
                  {currentValue && (
                    <ListItem>
                      <Button
                        w="full"
                        variant="ghost"
                        justifyContent="flex-start"
                        color="red.500"
                        size="sm"
                        leftIcon={<CloseIcon boxSize={2.5} />}
                        onClick={handleDrawerClear}
                        mb={1}
                      >
                        Xóa lựa chọn
                      </Button>
                    </ListItem>
                  )}
                  {filtered.length === 0 ? (
                    <ListItem>
                      <Text color="gray.400" textAlign="center" py={4} fontSize="sm">
                        Không tìm thấy kết quả
                      </Text>
                    </ListItem>
                  ) : (
                    filtered.map((option) => (
                      <ListItem key={option.value}>
                        <Button
                          w="full"
                          variant={option.value === currentValue ? "solid" : "ghost"}
                          colorScheme={option.value === currentValue ? "brand" : undefined}
                          justifyContent="flex-start"
                          fontWeight={option.value === currentValue ? "semibold" : "normal"}
                          onClick={() => handleDrawerSelect(option.value)}
                          size="md"
                        >
                          {option.label}
                        </Button>
                      </ListItem>
                    ))
                  )}
                </List>
                </>
              );
            })()}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
