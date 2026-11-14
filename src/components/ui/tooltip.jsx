"use client";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
function Tooltip({ ...props }) {
    return <TooltipPrimitive.Root data-slot="tooltip" {...props}/>;
}
export { Tooltip };