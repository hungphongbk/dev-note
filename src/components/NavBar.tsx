"use client";

import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Link,
  SimpleGrid,
  Text,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { AddIcon, EditIcon, HamburgerIcon, SettingsIcon, StarIcon, TimeIcon } from "@chakra-ui/icons";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { preloadNewPageLists } from "@/lib/newPageListPreload";

const NAV_LINKS = [
  { href: "/new", label: "Thêm mới", description: "Ghi chú tráng film", icon: AddIcon },
  { href: "/log", label: "Nhật kí", description: "Danh sách đã lưu", icon: TimeIcon },
  { href: "/pricing", label: "Bảng giá", description: "Tráng scan", icon: StarIcon },
  { href: "/film-stocks", label: "Film", description: "Quản lý kho film", icon: SettingsIcon },
];

export function NavBar() {
  const pathname = usePathname();
  const drawer = useDisclosure();
  const bg = useColorModeValue("brand.500", "brand.700");

  return (
    <Box as="nav" bg={bg} px={{ base: 3, md: 4 }} py={3} shadow="md">
      <Flex maxW="6xl" mx="auto" align="center" justify="space-between">
        <HStack spacing={2} as={NextLink} href="/log" _hover={{ textDecoration: "none" }}>
          <Text fontSize="xl" color="white">🎞️</Text>
          <Text fontWeight="bold" color="white" fontSize={{ base: "md", sm: "lg" }}>
            Dev Note
          </Text>
        </HStack>

        <HStack spacing={2}>
          <Button
            as={NextLink}
            href="/new"
            leftIcon={<EditIcon />}
            size={{ base: "sm", md: "md" }}
            colorScheme="whiteAlpha"
            color="white"
            bg="whiteAlpha.200"
            borderWidth="1px"
            borderColor="whiteAlpha.400"
            borderRadius="full"
            px={{ base: 3, md: 4 }}
            _hover={{ bg: "whiteAlpha.300", textDecoration: "none" }}
            _active={{ bg: "whiteAlpha.400" }}
            onMouseEnter={preloadNewPageLists}
            onFocus={preloadNewPageLists}
          >
            <Text as="span" display={{ base: "none", sm: "inline" }}>
              Thêm mới
            </Text>
            <Text as="span" display={{ base: "inline", sm: "none" }}>
              Thêm
            </Text>
          </Button>

          <IconButton
            aria-label="Mở menu"
            icon={<HamburgerIcon boxSize={5} />}
            color="white"
            colorScheme="whiteAlpha"
            variant="ghost"
            borderRadius="full"
            onClick={drawer.onOpen}
          />
        </HStack>
      </Flex>

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={drawer.onClose}>
        <DrawerOverlay />
        <DrawerContent bg="gray.50">
          <DrawerCloseButton color="brand.700" />
          <DrawerHeader color="brand.700" pb={2}>
            Menu
          </DrawerHeader>
          <DrawerBody pt={2}>
            <SimpleGrid columns={2} spacing={3}>
              {NAV_LINKS.map(({ href, label, description, icon: MenuIcon }) => {
                const isActive = pathname === href;
                const shouldPreloadNewPageLists = href === "/new";

                return (
                  <Link
                    as={NextLink}
                    key={href}
                    href={href}
                    onClick={drawer.onClose}
                    onMouseEnter={() => {
                      if (shouldPreloadNewPageLists) {
                        preloadNewPageLists();
                      }
                    }}
                    onFocus={() => {
                      if (shouldPreloadNewPageLists) {
                        preloadNewPageLists();
                      }
                    }}
                    _hover={{ textDecoration: "none" }}
                  >
                    <VStack
                      align="flex-start"
                      justify="space-between"
                      minH="116px"
                      p={4}
                      borderWidth="1px"
                      borderColor={isActive ? "brand.300" : "gray.100"}
                      bg={isActive ? "brand.50" : "white"}
                      borderRadius="lg"
                      boxShadow={isActive ? "sm" : "none"}
                      transition="all 160ms ease"
                      _hover={{ borderColor: "brand.300", transform: "translateY(-1px)", boxShadow: "sm" }}
                    >
                      <Flex
                        boxSize="36px"
                        align="center"
                        justify="center"
                        borderRadius="full"
                        bg={isActive ? "brand.500" : "brand.50"}
                        color={isActive ? "white" : "brand.600"}
                      >
                        <MenuIcon />
                      </Flex>
                      <Box>
                        <Text fontWeight="bold" color="gray.900" lineHeight="1.2">
                          {label}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1} lineHeight="1.25">
                          {description}
                        </Text>
                      </Box>
                    </VStack>
                  </Link>
                );
              })}
            </SimpleGrid>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
