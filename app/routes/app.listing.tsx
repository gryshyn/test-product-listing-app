import {
    IndexTable,
    LegacyCard,
    useIndexResourceState,
    Text,
    Badge,
    useBreakpoints,Page,  Card, Thumbnail, Pagination,RangeSlider, PageActions, Button, BlockStack, IndexFilters, IndexFiltersProps, TabProps, useSetIndexFiltersMode, ChoiceList, TextField
  } from '@shopify/polaris';
import React from 'react';
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useNavigate } from "@remix-run/react";
//import {useMemo} from 'react';
import shopify from "app/shopify.server";
import { useLoaderData } from "@remix-run/react";
import {ArrowDownIcon, ExportIcon, PlusIcon} from '@shopify/polaris-icons';
import {useState, useCallback, useMemo} from 'react';

export async function loader({ request }) {
    const { admin } = await shopify.authenticate.admin(request);
    const url = new URL(request.url);
    const searchParam = url.searchParams;
    const rel = searchParam.get('rel');
    const cursor = searchParam.get('cursor');
    let searchString = `first: 5`;
    if(cursor && rel) {
      if(rel == "next") {
        searchString += `, after: "${cursor}"`;
      } else {
        searchString = `last: 5, before: "${cursor}"`;
      }
    }
    const response = await admin.graphql(`
      query{
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
            description
            status
            totalInventory
            collections(first: 5) {  # Fetch up to 5 collections per product
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
          }
        }
      }`);
    const parsedResponse = await response.json();
    const products = parsedResponse.data.products.nodes;
    //console.log(products,)
    const pageInfo = parsedResponse.data.products.pageInfo;
    console.log(products)
    return json({ products, pageInfo });
  }

function Shopdata() {

      const resourceName = {
        singular: 'product',
        plural: 'products',
      };
    
      const { products, pageInfo} = useLoaderData();
      console.log(pageInfo, '[page info: ]')
    //   console.log(products.length, '[count of products: ]')
      const navigate = useNavigate();
      const pagination = useMemo(() => {
          const { hasNextPage, hasPreviousPage, startCursor, endCursor } =  pageInfo || {};
  
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
    console.log(pageInfo, '[page info2 : ]')

      const {selectedResources, allResourcesSelected, handleSelectionChange} =
        useIndexResourceState(products);

            ///////////////////////////////// 
        

    const rowMarkup = products.map(
        ({ images, id, title, description, status, totalInventory, collections }, index) => (
        <IndexTable.Row 
            id={id}
            key={id}
            position={index}
            
        >
            <IndexTable.Cell>
                      <Thumbnail
                        source={images.edges?.[0]?.node?.url || 
                            "https://via.placeholder.com/30x40?text=No+Image"}
                        size={"large"}
                        alt={images?.edges?.[0]?.node?.altText ||  "Alt text"}
                       />
                </IndexTable.Cell>
            <IndexTable.Cell>
                <Text variant="bodyMd" fontWeight="bold" as="span">
                    {id.replace("gid://shopify/Product/", "")}
                </Text>
            </IndexTable.Cell>
            <IndexTable.Cell> {title} </IndexTable.Cell>
            <IndexTable.Cell><Badge> {status} </Badge></IndexTable.Cell>
            <IndexTable.Cell> {totalInventory} in stock </IndexTable.Cell>
            <IndexTable.Cell> {collections?.edges?.[0]?.node?.title} </IndexTable.Cell>
        </IndexTable.Row>
         )
    );

    return (
        <Page
            fullWidth
            title="All products"
            pagination={{
                hasNext: true,
            }}
        >
            <LegacyCard>
                
                <IndexTable
                    resourceName={resourceName}
                    itemCount={2}
                    headings={[
                    { title: "Image" },
                    { title: 'Id' },
                    { title: 'Title' },
                    { title: 'Status' },
                    { title: 'Inventory' },
                    { title: 'Collections' },
                    ]}
                    selectable={false}
                
                >
                    {rowMarkup}
                </IndexTable>
                <div className="navigation">
                      <Pagination
                                    hasPrevious={!pagination.previous.disabled}
                                    onPrevious={() =>navigate(pagination.previous.link)}
                                    hasNext={!pagination.next.disabled}
                                    onNext={() => navigate(pagination.next.link)}
                     />
                </div>
            </LegacyCard>
        </Page>
    );

    function disambiguateLabel(key: string, value: string | any[]): string {
        switch (key) {
          case 'moneySpent':
            return `Money spent is between $${value[0]} and $${value[1]}`;
          case 'taggedWith':
            return `Tagged with ${value}`;
          case 'accountStatus':
            return (value as string[]).map((val) => `Customer ${val}`).join(', ');
          default:
            return value as string;
        }
      }
    
      function isEmpty(value: string | string[]): boolean {
        if (Array.isArray(value)) {
          return value.length === 0;
        } else {
          return value === '' || value == null;
        }
      }
                
}



export default Shopdata;