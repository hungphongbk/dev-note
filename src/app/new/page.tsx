"use client";

import { useState, useEffect, useCallback, useRef, type PointerEvent } from "react";
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
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  SimpleGrid,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, SearchIcon, CloseIcon, ChevronDownIcon } from "@chakra-ui/icons";
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

interface DevNoteFilmInput {
  key: string;
  filmStockId: string;
  quantity: number;
}

type Process = keyof typeof PROCESS_LABELS;
type DrawerState = { type: "customer" } | { type: "film"; itemKey: string };

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6];
const DELETE_REVEAL_WIDTH = 72;

function createEmptyFilmItem(): DevNoteFilmInput {
  return {
    key: `${Date.now()}-${Math.random()}`,
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

  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerBrand, setDrawerBrand] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filmStocks, setFilmStocks] = useState<FilmStock[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<DevNoteFilmInput[]>([createEmptyFilmItem()]);
  const [process, setProcess] = useState<Process | "">("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [openDeleteKey, setOpenDeleteKey] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ key: string; offset: number } | null>(null);
  const swipeRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    startOffset: number;
    isDragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);

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
      setCustomerId(String(created.id));
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
          return [...prev, { ...createEmptyFilmItem(), filmStockId: String(created.id) }];
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

  const selectedCustomerName =
    customers.find((customer) => String(customer.id) === customerId)?.name ?? "Chọn khách hàng...";

  const openMobileDrawer = (state: DrawerState) => {
    setDrawerState(state);
    setDrawerSearch("");
    setDrawerBrand(null);
    drawerDisclosure.onOpen();
  };

  const handleDrawerSelect = (value: string) => {
    if (!drawerState) return;
    if (drawerState.type === "customer") {
      setCustomerId(value);
    } else {
      handleUpdateItem(drawerState.itemKey, { filmStockId: value });
    }
    drawerDisclosure.onClose();
  };

  const handleDrawerClear = () => {
    if (!drawerState) return;
    if (drawerState.type === "customer") {
      setCustomerId("");
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

  const rollCount = items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0);

  const handleUpdateItem = (key: string, patch: Partial<DevNoteFilmInput>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyFilmItem()]);
    setOpenDeleteKey(null);
  };

  const handleRemoveItem = (key: string) => {
    setOpenDeleteKey(null);
    setDragState(null);
    setItems((prev) => {
      if (prev.length === 1) {
        return [createEmptyFilmItem()];
      }
      return prev.filter((item) => item.key !== key);
    });
  };

  const handleSubmit = async () => {
    const hasInvalidFilm = items.some(
      (item) => !item.filmStockId || !Number.isInteger(item.quantity) || item.quantity < 1
    );

    if (!customerId || hasInvalidFilm) {
      toast({ title: "Vui lòng chọn khách hàng, film và số lượng", status: "warning", duration: 3000 });
      return;
    }

    if (!process) {
      toast({ title: "Vui lòng chọn quy trình", status: "warning", duration: 3000 });
      return;
    }

    const payloadItems = items.map((item) => ({
      customerId: parseInt(customerId),
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

  const getSwipeOffset = (key: string) => {
    if (dragState?.key === key) {
      return dragState.offset;
    }
    return openDeleteKey === key ? -DELETE_REVEAL_WIDTH : 0;
  };

  const handleSwipeStart = (event: PointerEvent<HTMLDivElement>, key: string) => {
    if (!isMobile) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    swipeRef.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: openDeleteKey === key ? -DELETE_REVEAL_WIDTH : 0,
      isDragging: false,
    };
  };

  const handleSwipeMove = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!isMobile || !swipe) return;

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;

    if (!swipe.isDragging && Math.abs(deltaX) < 8) return;
    if (!swipe.isDragging && Math.abs(deltaY) > Math.abs(deltaX)) return;

    swipe.isDragging = true;
    const nextOffset = Math.min(0, Math.max(-DELETE_REVEAL_WIDTH, swipe.startOffset + deltaX));
    setOpenDeleteKey(swipe.key);
    setDragState({ key: swipe.key, offset: nextOffset });
  };

  const handleSwipeEnd = () => {
    const swipe = swipeRef.current;
    if (!swipe) return;

    const offset = dragState?.key === swipe.key ? dragState.offset : swipe.startOffset;
    const shouldOpen = offset < -DELETE_REVEAL_WIDTH / 2;
    if (swipe.isDragging) {
      suppressClickRef.current = swipe.key;
      window.setTimeout(() => {
        suppressClickRef.current = null;
      }, 0);
    }
    setOpenDeleteKey(shouldOpen ? swipe.key : null);
    setDragState(null);
    swipeRef.current = null;
  };

  const renderFilmPicker = (item: DevNoteFilmInput) => (
    <HStack align="stretch" spacing={2}>
      <Box flex={1} minW={0}>
        {isMobile ? (
          <Button
            w="full"
            minH="44px"
            px={3}
            variant="outline"
            justifyContent="flex-start"
            fontWeight="normal"
            color={item.filmStockId ? "gray.800" : "gray.400"}
            borderColor="gray.200"
            bg="white"
            _active={{ transform: "scale(0.99)" }}
            data-swipe-ignore
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
            onClick={() => openMobileDrawer({ type: "film", itemKey: item.key })}
          >
            <Text noOfLines={1}>
              {item.filmStockId
                ? filmStocks.find((f) => String(f.id) === item.filmStockId)?.name ?? "Chọn film..."
                : "Chọn film..."}
            </Text>
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

      <Popover placement="bottom-end" isLazy>
        <PopoverTrigger>
          <Button
            minW={{ base: "58px", md: "68px" }}
            h="44px"
            px={3}
            borderRadius="full"
            colorScheme="brand"
            variant="outline"
            rightIcon={<ChevronDownIcon />}
            _active={{ transform: "translateY(1px)" }}
            data-swipe-ignore
          >
            {item.quantity}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          w={{ base: "300px", md: "216px" }}
          borderColor="brand.100"
          borderRadius="lg"
          boxShadow="0 18px 45px rgba(146, 69, 0, 0.22)"
          _focusVisible={{ outline: "none" }}
        >
          <PopoverArrow bg="white" />
          <PopoverBody p={{ base: 2, md: 3 }}>
            <SimpleGrid columns={{ base: 6, md: 3 }} spacing={2}>
              {QUANTITY_OPTIONS.map((count) => {
                const isActive = item.quantity === count;
                return (
                  <Button
                    key={count}
                    aria-label={`${count} cuộn`}
                    minW={{ base: "36px", md: "44px" }}
                    h={{ base: "36px", md: "44px" }}
                    borderRadius="full"
                    colorScheme="brand"
                    variant={isActive ? "solid" : "outline"}
                    fontWeight="bold"
                    onClick={() => handleUpdateItem(item.key, { quantity: count })}
                    _hover={{
                      transform: "translateY(-1px)",
                      boxShadow: "sm",
                    }}
                  >
                    {count}
                  </Button>
                );
              })}
            </SimpleGrid>
          </PopoverBody>
        </PopoverContent>
      </Popover>

      {!isMobile && (
        <IconButton
          aria-label="Xóa dòng film"
          icon={<DeleteIcon />}
          onClick={() => handleRemoveItem(item.key)}
          colorScheme="red"
          variant="ghost"
          minW="40px"
          h="44px"
        />
      )}
    </HStack>
  );

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar />
      <Box maxW="4xl" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 4, md: 8 }}>
        <Heading size={{ base: "md", md: "lg" }} mb={{ base: 4, md: 6 }} color="brand.600">
          Thêm ghi chú tráng film
        </Heading>

        <VStack
          spacing={{ base: 4, md: 6 }}
          align="stretch"
          bg="white"
          p={{ base: 4, md: 6 }}
          borderRadius={{ base: "lg", md: "xl" }}
          shadow="sm"
        >
          <FormControl isRequired>
            <FormLabel fontWeight="semibold" mb={2}>
              Khách hàng
            </FormLabel>
            <HStack align="stretch" spacing={2}>
              <Box flex={1} minW={0}>
                {isMobile ? (
                  <Button
                    w="full"
                    minH="46px"
                    px={3}
                    variant="outline"
                    justifyContent="flex-start"
                    fontWeight="normal"
                    color={customerId ? "gray.800" : "gray.400"}
                    borderColor="gray.200"
                    bg="white"
                    rightIcon={
                      customerId ? (
                        <CloseIcon
                          boxSize={2.5}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomerId("");
                          }}
                        />
                      ) : undefined
                    }
                    onClick={() => openMobileDrawer({ type: "customer" })}
                  >
                    <Text noOfLines={1}>{selectedCustomerName}</Text>
                  </Button>
                ) : (
                  <ChakraReactSelect<SelectOption, false>
                    placeholder="Chọn khách hàng..."
                    options={customerOptions}
                    value={customerOptions.find((option) => option.value === customerId) ?? null}
                    onChange={(option) => setCustomerId(option?.value ?? "")}
                    isClearable
                  />
                )}
              </Box>
              <IconButton
                aria-label="Thêm khách mới"
                icon={<AddIcon />}
                colorScheme="brand"
                variant="outline"
                minW="46px"
                onClick={customerModal.onOpen}
              />
            </HStack>
          </FormControl>

          <FormControl isRequired>
            <Flex justify="space-between" align="center" mb={2} gap={3}>
              <FormLabel fontWeight="semibold" mb={0}>
                Film
              </FormLabel>
              <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={2}>
                {rollCount} cuộn
              </Badge>
            </Flex>

            <VStack align="stretch" spacing={{ base: 2, md: 3 }}>
              {items.map((item, index) => (
                <Box
                  key={item.key}
                  position="relative"
                  overflow="hidden"
                  borderWidth="1px"
                  borderColor={getSwipeOffset(item.key) < 0 ? "red.100" : "gray.100"}
                  borderRadius="lg"
                  bg="transparent"
                >
                  {isMobile && (
                    <Flex
                      position="absolute"
                      insetY={0}
                      right={0}
                      w={`${DELETE_REVEAL_WIDTH}px`}
                      align="center"
                      justify="center"
                      bg={getSwipeOffset(item.key) < 0 ? "red.500" : "transparent"}
                      opacity={getSwipeOffset(item.key) < 0 ? 1 : 0}
                      transition="opacity 120ms ease"
                    >
                      <IconButton
                        aria-label="Xóa dòng film"
                        icon={<DeleteIcon />}
                        onClick={() => handleRemoveItem(item.key)}
                        color="white"
                        colorScheme="red"
                        variant="ghost"
                        borderRadius="full"
                        _hover={{ bg: "red.600" }}
                        _active={{ bg: "red.700" }}
                      />
                    </Flex>
                  )}

                  <Box
                    data-testid={`film-row-${index + 1}`}
                    bg={item.filmStockId ? "brand.50" : "white"}
                    borderRadius="lg"
                    p={{ base: 2, md: 3 }}
                    transform={{
                      base: `translateX(${getSwipeOffset(item.key)}px)`,
                      md: "translateX(0)",
                    }}
                    transition={dragState?.key === item.key ? "none" : "transform 180ms ease, background-color 180ms ease"}
                    style={{ touchAction: "pan-y" }}
                    onPointerDown={(event) => handleSwipeStart(event, item.key)}
                    onPointerMove={handleSwipeMove}
                    onPointerUp={handleSwipeEnd}
                    onPointerCancel={handleSwipeEnd}
                    onClickCapture={(event) => {
                      if (suppressClickRef.current === item.key) {
                        event.stopPropagation();
                        return;
                      }
                      if (isMobile && openDeleteKey === item.key && !swipeRef.current?.isDragging) {
                        setOpenDeleteKey(null);
                        event.stopPropagation();
                      }
                    }}
                  >
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
                        Film {index + 1}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Số cuộn
                      </Text>
                    </Flex>
                    {renderFilmPicker(item)}
                  </Box>
                </Box>
              ))}
            </VStack>

            <Button
              mt={3}
              leftIcon={<AddIcon />}
              variant="outline"
              colorScheme="brand"
              size={{ base: "md", md: "md" }}
              w={{ base: "full", md: "auto" }}
              onClick={handleAddItem}
            >
              Thêm loại film
            </Button>
          </FormControl>

          <Divider />

          <FormControl isRequired>
            <FormLabel fontWeight="semibold" mb={2}>
              Quy trình
            </FormLabel>
            {isMobile ? (
              <Wrap spacing={2}>
                {PROCESS_VALUES.map((value) => {
                  const isActive = process === value;
                  return (
                    <WrapItem key={value}>
                      <Button
                        size="sm"
                        minH="38px"
                        borderRadius="full"
                        variant={isActive ? "solid" : "outline"}
                        colorScheme="brand"
                        onClick={() => setProcess(isActive ? "" : value)}
                      >
                        {PROCESS_LABELS[value]}
                      </Button>
                    </WrapItem>
                  );
                })}
              </Wrap>
            ) : (
              <ChakraReactSelect<SelectOption, false>
                placeholder="Chọn quy trình..."
                options={processOptions}
                value={selectedProcessOption}
                onChange={(option) => setProcess((option?.value as Process | undefined) ?? "")}
              />
            )}
          </FormControl>

          <FormControl>
            <FormLabel fontWeight="semibold" mb={2}>
              Ghi chú
            </FormLabel>
            <Textarea
              placeholder="Ghi chú thêm (tuỳ chọn)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              resize="vertical"
            />
          </FormControl>

          <Flex justify="flex-end" pt={{ base: 0, md: 2 }}>
            <Button
              colorScheme="brand"
              size="lg"
              px={8}
              w={{ base: "full", md: "auto" }}
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
        <ModalContent mx={4}>
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
        <ModalContent mx={4}>
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

      <Drawer
        isOpen={drawerDisclosure.isOpen}
        placement="bottom"
        onClose={drawerDisclosure.onClose}
      >
        <DrawerOverlay />
        <DrawerContent borderTopRadius="xl" maxH="72vh">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" pb={3}>
            <Flex align="center" gap={2}>
              {drawerState?.type === "customer" ? "Chọn khách hàng" : "Chọn film"}
              {drawerState && (
                (() => {
                  const options = drawerState.type === "customer" ? customerOptions : filmOptions;
                  const currentValue = drawerState.type === "customer"
                    ? customerId
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
              />
            </InputGroup>

            {(() => {
              const options = drawerState?.type === "customer" ? customerOptions : filmOptions;

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
                  ? customerId
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
