import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from './dialog'

describe('ui batch B smoke', () => {
  it('renders table/tabs/dialog primitives', () => {
    const { container } = render(
      <>
        <Table>
          <TableHeader><TableRow><TableHead>H</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>c</TableCell></TableRow></TableBody>
        </Table>
        <Tabs defaultValue="a">
          <TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList>
          <TabsContent value="a">content</TabsContent>
        </Tabs>
        <Dialog>
          <DialogTrigger>open</DialogTrigger>
          <DialogContent><DialogTitle>T</DialogTitle></DialogContent>
        </Dialog>
      </>,
    )
    expect(container.querySelector('[data-slot="table"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="tabs"]')).toBeTruthy()
    expect(screen.getByText('open')).toBeInTheDocument()
  })
})
