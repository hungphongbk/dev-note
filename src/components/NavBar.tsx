"use client";

import {
  Box,
  Flex,
  HStack,
  Link,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { preloadNewPageLists } from "@/lib/newPageListPreload";

const NAV_LINKS = [
  { href: "/new", label: "Thêm mới" },
  { href: "/log", label: "Nhật kí" },
];

export function NavBar() {
  const pathname = usePathname();
  const bg = useColorModeValue("brand.500", "brand.700");
  const activeColor = "white";
  const inactiveColor = "brand.100";

  return (
    <Box as="nav" bg={bg} px={4} py={3} shadow="md">
      <Flex maxW="6xl" mx="auto" align="center" justify="space-between">
        <HStack spacing={2} as={NextLink} href="/log" _hover={{ textDecoration: "none" }}>
          <Text fontSize="xl" color="white">🎞️</Text>
          <Text fontWeight="bold" color="white" fontSize="lg">
            Dev Note
          </Text>
        </HStack>

        <HStack spacing={6}>
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            const shouldPreloadNewPageLists = href === "/new";
            return (
              <Link
                as={NextLink}
                key={href}
                href={href}
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
                fontWeight={isActive ? "bold" : "medium"}
                color={isActive ? activeColor : inactiveColor}
                borderBottom={isActive ? "2px solid white" : "none"}
                pb={0.5}
                _hover={{ color: "white", textDecoration: "none" }}
              >
                {label}
              </Link>
            );
          })}
        </HStack>
      </Flex>
    </Box>
  );
}
