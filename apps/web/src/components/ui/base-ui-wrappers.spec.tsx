import * as React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PrimitiveSlot } from '@/components/ui/primitive-slot'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Toaster } from '@/components/ui/toaster'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast, toastManager } from '@/hooks/use-toast'

describe('Base UI wrapper compatibility', () => {
  it('keeps Button asChild composition', () => {
    render(
      <Button asChild>
        <a href='/apps'>Apps</a>
      </Button>
    )

    expect(screen.getByRole('link', { name: 'Apps' }).getAttribute('href')).toBe('/apps')
    expect(screen.getByRole('link', { name: 'Apps' }).getAttribute('data-slot')).toBe('button')
  })

  it('does not add a synthetic ref when asChild has no refs to compose', () => {
    let observedRef: React.Ref<HTMLAnchorElement> | undefined
    const RefProbe = ({ ref: refProp }: { ref?: React.Ref<HTMLAnchorElement> }) => {
      observedRef = refProp
      return <a href='/apps'>Apps</a>
    }

    render(
      <PrimitiveSlot>
        <RefProbe />
      </PrimitiveSlot>
    )

    expect(observedRef).toBeUndefined()
  })

  it('closes Dialog through the local close control', () => {
    const onDialogOpenChange = vi.fn()

    render(
      <Dialog
        open
        onOpenChange={onDialogOpenChange}
      >
        <DialogContent showCloseButton={false}>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogClose>Close dialog</DialogClose>
        </DialogContent>
      </Dialog>
    )

    fireEvent.click(screen.getByText('Close dialog'))
    expect(onDialogOpenChange).toHaveBeenCalledWith(false, expect.any(Object))
  })

  it('closes Sheet through the local close control', () => {
    const onSheetOpenChange = vi.fn()

    render(
      <Sheet
        open
        onOpenChange={onSheetOpenChange}
      >
        <SheetContent>
          <SheetTitle>Sheet title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    fireEvent.click(screen.getByText('Close'))
    expect(onSheetOpenChange).toHaveBeenCalledWith(false, expect.any(Object))
  })

  it('opens Drawer through an asChild trigger', () => {
    const onOpenChange = vi.fn()

    render(
      <Drawer onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>
          <button type='button'>Open drawer</button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Drawer title</DrawerTitle>
        </DrawerContent>
      </Drawer>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }))
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.any(Object))
  })

  it('keeps Select, Checkbox, and Switch controlled change callbacks non-null', () => {
    const onSelectChange = vi.fn()
    const onCheckboxChange = vi.fn()
    const onSwitchChange = vi.fn()

    render(
      <>
        <Select
          defaultOpen
          value='one'
          onValueChange={onSelectChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='one'>One</SelectItem>
            <SelectItem value='two'>Two</SelectItem>
          </SelectContent>
        </Select>
        <Checkbox
          checked={false}
          onCheckedChange={onCheckboxChange}
        />
        <Switch
          checked={false}
          onCheckedChange={onSwitchChange}
        />
      </>
    )

    fireEvent.pointerDown(screen.getByText('Two'), { pointerType: 'mouse' })
    fireEvent.click(screen.getByText('Two'))
    expect(onSelectChange).toHaveBeenCalledWith('two')

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCheckboxChange).toHaveBeenCalledWith(true, expect.any(Object))

    fireEvent.click(screen.getByRole('switch'))
    expect(onSwitchChange).toHaveBeenCalledWith(true, expect.any(Object))
  })

  it('shows Select item labels instead of raw values', async () => {
    render(
      <Select value='name-asc'>
        <SelectTrigger aria-label='Sort apps'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='name-asc'>Name A-Z</SelectItem>
          <SelectItem value='name-desc'>Name Z-A</SelectItem>
        </SelectContent>
      </Select>
    )

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /sort apps/i }).textContent).toContain('Name A-Z')
    })
  })

  it('keeps Slider change callbacks array-shaped', () => {
    const onSliderChange = vi.fn()

    render(
      <Slider
        aria-label='Bitrate range'
        min={0}
        max={10}
        step={1}
        value={[5]}
        onValueChange={onSliderChange}
      />
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Bitrate range' }), { key: 'ArrowRight' })
    expect(onSliderChange).toHaveBeenCalledWith([6])
  })

  it('preserves menu and context-menu onSelect handlers', () => {
    const onDropdownSelect = vi.fn()
    const onContextSelect = vi.fn()

    render(
      <>
        <DropdownMenu open>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onDropdownSelect}>Dropdown action</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ContextMenu open>
          <ContextMenuTrigger>Context target</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={onContextSelect}>Context action</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </>
    )

    fireEvent.click(screen.getByText('Dropdown action'))
    expect(onDropdownSelect).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Context action'))
    expect(onContextSelect).toHaveBeenCalledTimes(1)
  })

  it('renders dropdown labels inside Base UI menu groups', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Grouped actions</DropdownMenuLabel>
            <DropdownMenuItem>Action</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.getByText('Grouped actions')).toBeTruthy()
    expect(screen.getByRole('group')).toBeTruthy()
  })

  it('renders popover and tooltip triggers through asChild', () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Popover>
          <PopoverTrigger asChild>
            <button type='button'>Open popover</button>
          </PopoverTrigger>
          <PopoverContent>Popover body</PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type='button'>Show tooltip</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip body</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.getByRole('button', { name: 'Open popover' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show tooltip' })).toBeTruthy()
  })

  it('enqueues and dismisses toasts through the preserved toast function', async () => {
    render(<Toaster />)

    act(() => {
      toast({ title: 'Saved', description: 'Settings persisted.' })
    })

    expect(await screen.findByText('Saved')).toBeTruthy()
    fireEvent.mouseEnter(screen.getByRole('region', { name: 'Notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByText('Saved')).toBeNull()
    })

    act(() => {
      toastManager.close()
    })
  })
})
