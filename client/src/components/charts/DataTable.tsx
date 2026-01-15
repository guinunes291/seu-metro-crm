import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  title?: string;
  description?: string;
}

export function DataTable({ data, columns, title, description }: DataTableProps) {
  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead 
                    key={col.key}
                    className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    Nenhum dado disponível
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map((col) => (
                      <TableCell 
                        key={col.key}
                        className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                      >
                        {col.format ? col.format(row[col.key]) : row[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
