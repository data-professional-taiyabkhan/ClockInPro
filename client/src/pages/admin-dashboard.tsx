import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Plus, Edit, Trash2, Building2 } from "lucide-react";
import type { Location, InsertLocation } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: InsertLocation) => {
      return await apiRequest("/api/locations", { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsLocationDialogOpen(false);
      toast({
        title: "Success",
        description: "Location created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Location> & { id: number }) => {
      return await apiRequest(`/api/locations/${id}`, { method: "PUT", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsLocationDialogOpen(false);
      setEditingLocation(null);
      toast({
        title: "Success",
        description: "Location updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/locations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const locationData = {
      name: formData.get("name") as string,
      postcode: formData.get("postcode") as string,
      address: formData.get("address") as string,
      latitude: formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : null,
      longitude: formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : null,
      radiusMeters: parseInt(formData.get("radiusMeters") as string) || 100,
    };

    if (editingLocation) {
      updateLocationMutation.mutate({ id: editingLocation.id, ...locationData });
    } else {
      createLocationMutation.mutate(locationData);
    }
  };

  const openLocationDialog = (location?: Location) => {
    if (location) {
      console.log("Opening edit dialog for location:", location);
    } else {
      console.log("Opening create dialog");
    }
    setEditingLocation(location || null);
    setIsLocationDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Manage office locations and system settings</p>
        </div>

        {/* Locations Management */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Office Locations
                </CardTitle>
                <CardDescription>
                  Manage office locations where employees can check in
                </CardDescription>
              </div>
              <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openLocationDialog()} size="lg" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Location
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingLocation ? "Edit Location" : "Add New Location"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingLocation ? "Update location details" : "Create a new office location"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Location Name</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingLocation?.name || ""}
                        placeholder="Main Office"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        name="postcode"
                        defaultValue={editingLocation?.postcode || ""}
                        placeholder="SW1A 1AA"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        name="address"
                        defaultValue={editingLocation?.address || ""}
                        placeholder="123 Business Street, London"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          name="latitude"
                          type="number"
                          step="any"
                          defaultValue={editingLocation?.latitude || ""}
                          placeholder="51.5074"
                        />
                      </div>
                      <div>
                        <Label htmlFor="longitude">Longitude</Label>
                        <Input
                          id="longitude"
                          name="longitude"
                          type="number"
                          step="any"
                          defaultValue={editingLocation?.longitude || ""}
                          placeholder="-0.1278"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="radiusMeters">Check-in Radius (meters)</Label>
                      <Input
                        id="radiusMeters"
                        name="radiusMeters"
                        type="number"
                        defaultValue={editingLocation?.radiusMeters || 100}
                        placeholder="100"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsLocationDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                      >
                        {editingLocation ? "Update" : "Create"} Location
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {locationsLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Coordinates</TableHead>
                      <TableHead>Radius</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((location: Location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.name}</TableCell>
                        <TableCell>{location.postcode}</TableCell>
                        <TableCell className="max-w-xs truncate">{location.address}</TableCell>
                        <TableCell>
                          {location.latitude && location.longitude ? (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>{location.radiusMeters}m</TableCell>
                        <TableCell>
                          <Badge variant={location.isActive ? "default" : "secondary"}>
                            {location.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-40">
                          <div className="flex space-x-2 justify-start">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log("Edit button clicked for:", location.name);
                                openLocationDialog(location);
                              }}
                              className="flex items-center gap-1 min-w-fit"
                              title="Edit location"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                console.log("Delete button clicked for:", location.name);
                                if (window.confirm(`Are you sure you want to delete "${location.name}"? This will remove all employee assignments to this location.`)) {
                                  deleteLocationMutation.mutate(location.id);
                                }
                              }}
                              disabled={deleteLocationMutation.isPending}
                              className="flex items-center gap-1 min-w-fit bg-red-600 hover:bg-red-700"
                              title="Delete location"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}