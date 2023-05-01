import type { CustomTableEvents, IColumnMetaData } from "$lib/components/DataTable";

export function repositionableColumn(node: Node, column: IColumnMetaData, columnResizing: boolean) { //columnResizing binding doesn't work
    function handleDragStart(event: DragEvent) {
        if (column.repositionable === false || columnResizing) return
        const data = { column: column.id }
        event.dataTransfer!.setData('text/plain', JSON.stringify(data))
    }

    function handleDragOver(event: DragEvent) {
        if (column.repositionable === false || columnResizing) return
        event.preventDefault()
    }

    function handleDrop(event: DragEvent) {
        if (column.repositionable === false || columnResizing) return
        event.preventDefault()
        try {
            const json = event.dataTransfer!.getData('text/plain')
            const data = JSON.parse(json)

            node.dispatchEvent(
                new CustomEvent("repositioned", {
                    detail: { column: data.column, position: column.position ?? Number.MAX_SAFE_INTEGER },
                })
            );
        } catch { }
    }


    node.addEventListener("dragstart", handleDragStart, true);
    node.addEventListener("dragover", handleDragOver, true);
    node.addEventListener("drop", handleDrop, true);

    return {
        destroy() {
            node.removeEventListener("dragstart", handleDragStart, true);
            node.removeEventListener("dragover", handleDragOver, true);
            node.removeEventListener("drop", handleDrop, true);
        },
    };
}