import {
    IndexTable,
    LegacyCard,
    useIndexResourceState,
    Text,
    Badge,
    Page,
    Thumbnail,
    Pagination,
    IndexFilters,
    TextField,
    useSetIndexFiltersMode,
    IndexFiltersMode,
    TabProps
  } from '@shopify/polaris';
  import { json } from "@remix-run/node"; 
  import { useNavigate, useLoaderData } from "@remix-run/react";
  import { useState, useMemo, useCallback } from 'react';
  import shopify from "app/shopify.server";
  
  export async function loader({ request }) {
    const { admin } = await shopify.authenticate.admin(request);
    const url = new URL(request.url);
    const searchParam = url.searchParams;
    const rel = searchParam.get('rel');
    const cursor = searchParam.get('cursor');
    
    let searchString = `first: 5`;
    if (cursor && rel) {
      if (rel === "next") searchString += `, after: "${cursor}"`;
      else searchString = `last: 5, before: "${cursor}"`;
    }
  
    const response = await admin.graphql(`
      query {
        products(${searchString}) {
          pageInfo {
            endCursor
            hasNextPage
            hasPreviousPage
            startCursor
          }
          nodes {
            id
            title
            status
            totalInventory
            collections(first: 5) {  
              edges {
                node {
                  id
                  title
                }
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            metafields(first: 1) {
                    edges {
                        node {
                            value
                        }
                    }
                }
          }
        }
      }
    `);
    
    const parsedResponse = await response.json();
    const products = parsedResponse.data.products.nodes;
    const pageInfo = parsedResponse.data.products.pageInfo;
    
    return json({ products, pageInfo });
  }
  
  function ListingPage() {
    const { products, pageInfo } = useLoaderData();
    const navigate = useNavigate();
  
    // Filter states
    const [queryValue, setQueryValue] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [collectionFilter, setCollectionFilter] = useState('');
  
    // Filter change handlers
    const handleQueryChange = useCallback((value) => setQueryValue(value), []);
    const handleStatusChange = useCallback((value) => setStatusFilter(value), []);
    
    const handleClearFilters = useCallback(() => {
      setQueryValue('');
      setStatusFilter('');
      setCollectionFilter('');
    }, []);
    
    // Filtered products
    const filteredProducts = Array.isArray(products)
  ? products.filter((product) => {
      const matchesQuery = queryValue === '' || product.title.toLowerCase().includes(queryValue.toLowerCase());
      const matchesStatus = statusFilter === '' || product.status === statusFilter;
      const matchesCollection = 
        collectionFilter === '' || 
        product.collections?.edges?.some(({ node }) => node.title.includes(collectionFilter));

      return matchesQuery && matchesStatus && matchesCollection;
    })
  : [];

    const { selectedResources, allResourcesSelected, handleSelectionChange } =
      useIndexResourceState(filteredProducts);
  
    const pagination = useMemo(() => {
      const { hasNextPage, hasPreviousPage, startCursor, endCursor } = pageInfo || {};
      return {
        previous: {
          disabled: !hasPreviousPage || !startCursor,
          link: `/app/listing/?rel=previous&cursor=${startCursor}`,                  
        },
        next: {
          disabled: !hasNextPage || !endCursor,
          link: `/app/listing/?rel=next&cursor=${endCursor}`,
        },
      };
    }, [pageInfo]);

    const [sortSelected, setSortSelected] = useState(["order asc"]);
    const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);
    const onHandleCancel = () => {};

    const [itemStrings, setItemStrings] = useState([
        "All",
        "Meta fields",
      ]);

    const tabs: TabProps[] = itemStrings.map((item, index) => ({
        content: item,
        index,
        onAction: () => {},
        id: `${item}-${index}`,
        isLocked: index === 0,
        actions: [],
      }));
    
      const [selected, setSelected] = useState(0);

    const rowMarkup = filteredProducts.length > 0 
    ? filteredProducts.map(({ id, title, status, totalInventory, collections, images, metafields }, index) => (
        <IndexTable.Row id={id} key={id} position={index}>
          <IndexTable.Cell>
            <Thumbnail
              source={images?.edges?.[0]?.node?.url || "https://via.placeholder.com/30x40?text=No+Image"}
              size="large"
              alt={images?.edges?.[0]?.node?.altText || "Alt text"}
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {id.replace("gid://shopify/Product/", "")}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{title}</IndexTable.Cell>
          <IndexTable.Cell><Badge>{status}</Badge></IndexTable.Cell>
          <IndexTable.Cell>{totalInventory} in stock</IndexTable.Cell>
          <IndexTable.Cell>
            {collections?.edges?.length > 0 
              ? collections.edges[0].node.title 
              : "No Collection"}
          </IndexTable.Cell>
          <IndexTable.Cell>
                {metafields?.edges?.[0]?.node?.value || "No value"}
          </IndexTable.Cell>
        </IndexTable.Row>
      ))
    : <IndexTable.Row>
        <IndexTable.Cell colSpan={6}>
          <Text>No products available</Text>
        </IndexTable.Cell>
      </IndexTable.Row>;
  
    return (
      <Page fullWidth title="All Products">
        <LegacyCard>
          <IndexFilters
            queryValue={queryValue}
            onQueryChange={handleQueryChange}
            onQueryClear={() => setQueryValue('')}
            filters={[
              {
                key: 'statusFilter',
                label: 'Status',
                filter: (
                  <TextField
                    labelHidden
                    label="Status"
                    value={statusFilter}
                    onChange={handleStatusChange}
                    placeholder="Enter status (e.g., active)"
                  />
                ),
                shortcut: true,
              },
            ]}
            onClearAll={handleClearFilters}
            mode={mode}
            setMode={setMode}
            tabs={tabs}
            selected={selected}
            onSelect={setSelected}
          />
          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={filteredProducts.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: "Image" },
              { title: "Id" },
              { title: "Title" },
              { title: "Status" },
              { title: "Inventory" },
              { title: "Collections" },
              { title: "Metafields" },
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
          <div className="navigation">
            <Pagination
              hasPrevious={!pagination.previous.disabled}
              onPrevious={() => navigate(pagination.previous.link)}
              hasNext={!pagination.next.disabled}
              onNext={() => navigate(pagination.next.link)}
            />
          </div>
        </LegacyCard>
      </Page>
    );
}
  
export default ListingPage;
  