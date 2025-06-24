import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, Location } from "@shared/schema";

interface LocationAssignmentProps {
  employee: User;
  onClose: () => void;
}

export function LocationAssignment({ employee, onClose }: LocationAssignmentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>(
    employee.assignedLocations || []
  );

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
  });

  const updateLocationsMutation = useMutation({
    mutationFn: async (locationIds: number[]) => {
      await apiRequest(`/api/employees/${employee.id}/locations`, {
        method: "PUT",
        body: JSON.stringify({ locationIds }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee locations updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLocationToggle = (locationId: number, checked: boolean) => {
    if (checked) {
      setSelectedLocationIds([...selectedLocationIds, locationId]);
    } else {
      setSelectedLocationIds(selectedLocationIds.filter(id => id !== locationId));
    }
  };

  const handleSave = () => {
    updateLocationsMutation.mutate(selectedLocationIds);
  };

  if (locationsLoading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Loading locations...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          Assign Locations - {employee.firstName} {employee.lastName}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Select the locations where this employee is allowed to work
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {locations.map((location: Location) => (
            <div
              key={location.id}
              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
            >
              <Checkbox
                id={`location-${location.id}`}
                checked={selectedLocationIds.includes(location.id)}
                onCheckedChange={(checked) =>
                  handleLocationToggle(location.id, checked as boolean)
                }
              />
              <div className="flex-1">
                <label
                  htmlFor={`location-${location.id}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {location.name}
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{location.postcode}</Badge>
                  {location.address && (
                    <span className="text-xs text-gray-500">{location.address}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No locations available. Contact admin to add locations.
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateLocationsMutation.isPending}
          >
            {updateLocationsMutation.isPending ? "Saving..." : "Save Assignments"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}