import { useEffect, type MouseEventHandler, type ReactNode, type RefObject } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface InteractiveSeatCanvasProps {
    canvasRef: RefObject<HTMLDivElement | null>
    cursor: { x: number; y: number } | null
    viewport: { scale: number; offsetX: number; offsetY: number }
    cursorClassName: string
    footerLeft?: ReactNode
    footerRight: ReactNode
    children: ReactNode
    toolbar?: ReactNode
    onZoomIn: () => void
    onZoomOut: () => void
    onMouseDown?: MouseEventHandler<HTMLDivElement>
    onMouseMove?: MouseEventHandler<HTMLDivElement>
    onWheel?: (event: WheelEvent) => void
    onClick?: MouseEventHandler<HTMLDivElement>
    /** Khi có giá trị, chiều cao canvas được tính theo tỷ lệ CSS `aspect-ratio`.
     *  Nếu bỏ trống, component dùng `heightClassName` làm chiều cao dự phòng. */
    aspectRatio?: number
    heightClassName?: string
    gridSize?: string
}

export function InteractiveSeatCanvas({
    canvasRef,
    cursor,
    viewport,
    cursorClassName,
    footerLeft,
    footerRight,
    children,
    toolbar,
    onZoomIn,
    onZoomOut,
    onMouseDown,
    onMouseMove,
    onWheel,
    onClick,
    aspectRatio,
    heightClassName = 'h-[680px]',
    gridSize = '10% 10%',
}: InteractiveSeatCanvasProps) {
    useEffect(() => {
        const element = canvasRef.current
        if (!element || !onWheel) return

        element.addEventListener('wheel', onWheel, { passive: false })
        return () => element.removeEventListener('wheel', onWheel)
    }, [canvasRef, onWheel])

    return (
        <div className="space-y-3">
            {toolbar && (
                <div className="rounded-xl border border-white/10 bg-space-900/95 px-3 py-2 shadow-2xl backdrop-blur">
                    {toolbar}
                </div>
            )}

            <div
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onClick={onClick}
                className={cn(
                    'relative overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-inner',
                    aspectRatio ? '' : (heightClassName ?? 'h-[680px]'),
                    cursorClassName,
                )}
                style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
            >
                <div className="absolute left-4 top-4 z-20 rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
                    <div>X: <span className="font-semibold text-slate-900">{cursor?.x.toFixed(2) ?? '--'}</span></div>
                    <div>Y: <span className="font-semibold text-slate-900">{cursor?.y.toFixed(2) ?? '--'}</span></div>
                </div>

                <div className="absolute right-4 top-4 z-20 flex gap-2 rounded-xl border border-slate-300 bg-white/95 p-2 shadow-lg">
                    <Button size="icon" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={onZoomIn} title="Phóng to">
                        <ZoomIn className="h-4 w-4 text-black" />
                    </Button>
                    <Button size="icon" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={onZoomOut} title="Thu nhỏ">
                        <ZoomOut className="h-4 w-4 text-black" />
                    </Button>
                </div>

                <div
                    className="absolute inset-0 origin-top-left"
                    style={{
                        transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
                        transformOrigin: 'top left',
                    }}
                >
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
                            backgroundSize: gridSize,
                        }}
                    />
                    <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-slate-400/70" />
                    {children}
                </div>

                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-slate-300 bg-white/90 px-4 py-2 text-xs text-slate-700 shadow-lg">
                    <span>{footerLeft ?? ''}</span>
                    <span>{footerRight}</span>
                </div>
            </div>
        </div>
    )
}
