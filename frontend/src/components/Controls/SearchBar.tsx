// ABOUTME: Search bar component for finding and selecting nodes in the network graph
// ABOUTME: Features debounced search, dropdown results, keyboard navigation, and error feedback

"use client";

import { useState, useRef, useCallback } from "react";
import { GraphNode } from "@/types/graph";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchBarProps {
  /** All nodes available for searching */
  nodes: GraphNode[];

  /** Callback when user selects a node from search results */
  onNodeSelect: (nodeId: string) => void;

  /** Callback when user clears the search */
  onClear: () => void;
}

interface SearchResult {
  node: GraphNode;
  /** Type of match: 'exact-id' | 'prefix-id' | 'name' */
  matchType: "exact-id" | "prefix-id" | "name";
}

/**
 * Search bar component with auto-complete dropdown.
 * Supports case-insensitive prefix matching on IDs and partial matching on names.
 */
export function SearchBar({ nodes, onNodeSelect, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the query to avoid excessive filtering
  const debouncedQuery = useDebounce(query, 300);

  /**
   * Search nodes based on query.
   * - Exact ID match (case-insensitive)
   * - Prefix ID match (case-insensitive)
   * - Partial name match (case-insensitive, anywhere in string)
   */
  const searchNodes = useCallback(
    (searchQuery: string): SearchResult[] => {
      if (!searchQuery.trim()) return [];

      const lowerQuery = searchQuery.toLowerCase().trim();
      const results: SearchResult[] = [];

      nodes.forEach((node) => {
        const lowerNodeId = node.id.toLowerCase();
        const lowerNodeName = node.name.toLowerCase();

        // Exact ID match
        if (lowerNodeId === lowerQuery) {
          results.push({ node, matchType: "exact-id" });
        }
        // Prefix ID match
        else if (lowerNodeId.startsWith(lowerQuery)) {
          results.push({ node, matchType: "prefix-id" });
        }
        // Partial name match (anywhere in string)
        else if (lowerNodeName.includes(lowerQuery)) {
          results.push({ node, matchType: "name" });
        }
      });

      // Sort results: exact ID matches first, then prefix, then name matches
      results.sort((a, b) => {
        const priority = { "exact-id": 0, "prefix-id": 1, name: 2 };
        const priorityDiff = priority[a.matchType] - priority[b.matchType];
        if (priorityDiff !== 0) return priorityDiff;

        // Within same match type, sort alphabetically by name
        return a.node.name.localeCompare(b.node.name);
      });

      // Limit to 10 results
      return results.slice(0, 10);
    },
    [nodes]
  );

  const searchResults = searchNodes(debouncedQuery);

  // Derive dropdown and error states from current values instead of storing in state
  const isDropdownOpen = debouncedQuery.trim() !== "" && searchResults.length > 0;
  const showError = debouncedQuery.trim() !== "" && searchResults.length === 0;

  // Clamp selected index to valid range (handles case where results list shrinks)
  const clampedSelectedIndex = Math.max(
    0,
    Math.min(selectedIndex, searchResults.length - 1)
  );

  // Handle selecting a result
  const handleSelectResult = useCallback(
    (nodeId: string) => {
      onNodeSelect(nodeId);
      setQuery(""); // Clear search after selection (also closes dropdown and clears error)
      setSelectedIndex(0);
    },
    [onNodeSelect]
  );

  // Handle clearing search
  const handleClear = useCallback(() => {
    setQuery(""); // Clearing query automatically closes dropdown and clears error
    setSelectedIndex(0);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isDropdownOpen || searchResults.length === 0) {
        if (event.key === "Escape" && query) {
          handleClear();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;

        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;

        case "Enter":
          event.preventDefault();
          if (searchResults[clampedSelectedIndex]) {
            handleSelectResult(searchResults[clampedSelectedIndex].node.id);
          }
          break;

        case "Escape":
          event.preventDefault();
          handleClear();
          break;
      }
    },
    [
      isDropdownOpen,
      searchResults,
      clampedSelectedIndex,
      query,
      handleSelectResult,
      handleClear,
    ]
  );

  return (
    <div
      style={{
        position: "fixed",
        top: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        width: "min(600px, calc(100vw - 48px))",
      }}
    >
      {/* Search Input Container */}
      <div
        style={{
          position: "relative",
          backgroundColor: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          border: showError
            ? "2px solid rgba(239, 68, 68, 0.6)"
            : "1px solid rgba(148, 163, 184, 0.2)",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
          transition: "border-color 200ms ease-in-out",
        }}
      >
        {/* Search Icon */}
        <div
          style={{
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#94a3b8",
            pointerEvents: "none",
            fontSize: "18px",
          }}
        >
          🔍
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search nodes..."
          style={{
            width: "100%",
            height: "48px",
            paddingLeft: "48px",
            paddingRight: query ? "48px" : "16px",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            color: "#f1f5f9",
            fontSize: "16px",
            fontFamily: "inherit",
          }}
          aria-label="Search nodes"
          aria-controls="search-results-dropdown"
          aria-activedescendant={
            isDropdownOpen && searchResults[clampedSelectedIndex]
              ? `search-result-${searchResults[clampedSelectedIndex].node.id}`
              : undefined
          }
        />

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            onMouseEnter={() => setIsHovering("clear")}
            onMouseLeave={() => setIsHovering(null)}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "28px",
              height: "28px",
              backgroundColor:
                isHovering === "clear"
                  ? "rgba(59, 130, 246, 0.3)"
                  : "rgba(30, 41, 59, 0.6)",
              color: isHovering === "clear" ? "#60a5fa" : "#94a3b8",
              border: "1px solid",
              borderColor:
                isHovering === "clear"
                  ? "rgba(59, 130, 246, 0.5)"
                  : "rgba(148, 163, 184, 0.2)",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              userSelect: "none",
              transition: "all 200ms ease-in-out",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Clear search"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isDropdownOpen && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          id="search-results-dropdown"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            borderRadius: "12px",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
            maxHeight: "400px",
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {searchResults.map((result, index) => (
            <div
              key={result.node.id}
              id={`search-result-${result.node.id}`}
              role="option"
              aria-selected={index === clampedSelectedIndex}
              onClick={() => handleSelectResult(result.node.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor:
                  index === clampedSelectedIndex
                    ? "rgba(59, 130, 246, 0.2)"
                    : "transparent",
                border: "1px solid",
                borderColor:
                  index === clampedSelectedIndex
                    ? "rgba(59, 130, 246, 0.4)"
                    : "transparent",
                cursor: "pointer",
                transition: "all 150ms ease-in-out",
                marginBottom: index < searchResults.length - 1 ? "4px" : 0,
              }}
            >
              <div
                style={{
                  color: "#f1f5f9",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                {result.node.id}
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                }}
              >
                {result.node.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
