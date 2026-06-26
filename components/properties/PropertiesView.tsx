"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { PropertyListItem } from "@/types";

interface FormState {
  id: string | null;
  title: string;
  location: string;
  price: string;
  bedrooms: string;
  description: string;
  externalRef: string;
}

const EMPTY: FormState = {
  id: null,
  title: "",
  location: "",
  price: "",
  bedrooms: "",
  description: "",
  externalRef: "",
};

export function PropertiesView() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/properties");
      const json = await res.json();
      if (res.ok) setProperties(json.data as PropertyListItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(p: PropertyListItem) {
    setForm({
      id: p.id,
      title: p.title,
      location: p.location,
      price: p.price,
      bedrooms: p.bedrooms?.toString() ?? "",
      description: p.description ?? "",
      externalRef: p.externalRef ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        location: form.location,
        price: form.price,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        description: form.description || null,
        externalRef: form.externalRef || null,
      };
      const res = await fetch(
        form.id ? `/api/properties/${form.id}` : "/api/properties",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Save failed", description: json.error });
        return;
      }
      toast({ title: form.id ? "Property updated" : "Property added" });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Property deleted" });
      await load();
    } else {
      const json = await res.json();
      toast({ variant: "destructive", title: "Delete failed", description: json.error });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add property
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading properties…</p>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Building2 className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              No properties yet
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Add a property so incoming leads can be matched to it.
            </p>
            <Button className="mt-4" size="sm" onClick={openCreate}>
              Add your first property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {p.title}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {p.location}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-emerald-600">{p.price}</span>
                  <span className="text-slate-500">
                    {p._count.leads} {p._count.leads === 1 ? "lead" : "leads"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit property" : "Add property"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-title">Title</Label>
              <Input
                id="p-title"
                required
                placeholder="2BHK in Powai"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-location">Location</Label>
                <Input
                  id="p-location"
                  required
                  placeholder="Powai, Mumbai"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-price">Price</Label>
                <Input
                  id="p-price"
                  required
                  placeholder="₹85L"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-bed">Bedrooms</Label>
                <Input
                  id="p-bed"
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-ref">Portal ref (optional)</Label>
                <Input
                  id="p-ref"
                  placeholder="99acres listing ID"
                  value={form.externalRef}
                  onChange={(e) => setForm({ ...form, externalRef: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving…" : form.id ? "Save changes" : "Add property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
