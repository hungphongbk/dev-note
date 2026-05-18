"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
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
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { AddIcon, EditIcon } from "@chakra-ui/icons";
import { NavBar } from "@/components/NavBar";

interface FilmStock {
  id: number;
  name: string;
}

export default function FilmStocksPage() {
  const toast = useToast();
  const addModal = useDisclosure();
  const editModal = useDisclosure();

  const [filmStocks, setFilmStocks] = useState<FilmStock[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editTarget, setEditTarget] = useState<FilmStock | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFilmStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/film-stocks");
      const data = await res.json();
      setFilmStocks(data);
    } catch {
      toast({ title: "Không thể tải danh sách film", status: "error", duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFilmStocks();
  }, [fetchFilmStocks]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/film-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const created: FilmStock = await res.json();
      setFilmStocks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      addModal.onClose();
      toast({ title: "Đã thêm film mới", status: "success", duration: 2000 });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Lỗi", status: "error", duration: 3000 });
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (film: FilmStock) => {
    setEditTarget(film);
    setEditName(film.name);
    editModal.onOpen();
  };

  const handleEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/film-stocks/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const updated: FilmStock = await res.json();
      setFilmStocks((prev) =>
        prev.map((f) => (f.id === updated.id ? updated : f)).sort((a, b) => a.name.localeCompare(b.name))
      );
      editModal.onClose();
      toast({ title: "Đã cập nhật tên film", status: "success", duration: 2000 });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Lỗi", status: "error", duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar />
      <Box maxW="3xl" mx="auto" px={4} py={8}>
        <Flex align="center" justify="space-between" mb={6}>
          <Heading size="lg" color="brand.600">
            Quản lý tên film
          </Heading>
          <Button leftIcon={<AddIcon />} colorScheme="brand" onClick={addModal.onOpen}>
            Thêm film
          </Button>
        </Flex>

        <Box bg="white" borderRadius="xl" shadow="sm" overflow="hidden">
          {loading ? (
            <VStack py={12}>
              <Text color="gray.400">Đang tải...</Text>
            </VStack>
          ) : filmStocks.length === 0 ? (
            <VStack py={12}>
              <Text color="gray.400">Chưa có film nào.</Text>
            </VStack>
          ) : (
            <Table variant="simple" size="md">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Tên film</Th>
                  <Th w="60px" />
                </Tr>
              </Thead>
              <Tbody>
                {filmStocks.map((film) => (
                  <Tr key={film.id} _hover={{ bg: "gray.50" }}>
                    <Td fontWeight="medium">{film.name}</Td>
                    <Td>
                      <IconButton
                        aria-label={`Sửa ${film.name}`}
                        icon={<EditIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="brand"
                        onClick={() => openEdit(film)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </Box>

      {/* Add modal */}
      <Modal isOpen={addModal.isOpen} onClose={addModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Thêm film mới</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel>Tên film</FormLabel>
              <Input
                placeholder="vd: Kodak Gold 200"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={addModal.onClose}>
              Hủy
            </Button>
            <Button colorScheme="brand" onClick={handleAdd} isLoading={adding}>
              Thêm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sửa tên film</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel>Tên film</FormLabel>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Hủy
            </Button>
            <Button colorScheme="brand" onClick={handleEdit} isLoading={saving}>
              Lưu
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
