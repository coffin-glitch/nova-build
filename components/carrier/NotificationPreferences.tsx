"use client";

import { Button } from "@/components/ui/button";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccentColor } from "@/hooks/useAccentColor";
import { Bell, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface NotificationPreferences {
  emailNotifications: boolean;
  similarLoadNotifications: boolean;
  distanceThresholdMiles: number;
  statePreferences: string[];
  equipmentPreferences: string[];
  minDistance: number;
  maxDistance: number;
}

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    similarLoadNotifications: true,
    distanceThresholdMiles: 50,
    statePreferences: [],
    equipmentPreferences: [],
    minDistance: 0,
    maxDistance: 2000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newState, setNewState] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  
  const { accentColor, accentBgStyle } = useAccentColor();

  const { data, mutate } = useSWR(
    `/api/carrier/notification-preferences`,
    fetcher,
    { fallbackData: { ok: true, data: null } }
  );

  useEffect(() => {
    if (data?.data) {
      setPreferences(data.data);
    }
  }, [data]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/carrier/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Notification preferences saved!");
        mutate();
      } else {
        toast.error(result.error || "Failed to save preferences");
      }
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const addStatePreference = () => {
    if (newState.trim() && !preferences.statePreferences.includes(newState.trim())) {
      setPreferences(prev => ({
        ...prev,
        statePreferences: [...prev.statePreferences, newState.trim()]
      }));
      setNewState("");
    }
  };

  const removeStatePreference = (state: string) => {
    setPreferences(prev => ({
      ...prev,
      statePreferences: prev.statePreferences.filter(s => s !== state)
    }));
  };

  const addEquipmentPreference = () => {
    if (newEquipment.trim() && !preferences.equipmentPreferences.includes(newEquipment.trim())) {
      setPreferences(prev => ({
        ...prev,
        equipmentPreferences: [...prev.equipmentPreferences, newEquipment.trim()]
      }));
      setNewEquipment("");
    }
  };

  const removeEquipmentPreference = (equipment: string) => {
    setPreferences(prev => ({
      ...prev,
      equipmentPreferences: prev.equipmentPreferences.filter(e => e !== equipment)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Bell className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Notification Preferences</h2>
          <p className="text-muted-foreground">
            Configure how you want to be notified about new loads and updates
          </p>
        </div>
      </div>

      <Glass className="p-6 space-y-6">
        {/* Email Notifications */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Email Notifications</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Enable email notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email when new loads match your preferences
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.emailNotifications}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, emailNotifications: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="similar-loads">Similar load alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when loads similar to your favorites are posted
              </p>
            </div>
            <Switch
              id="similar-loads"
              checked={preferences.similarLoadNotifications}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, similarLoadNotifications: checked }))
              }
            />
          </div>
        </div>

        {/* Distance Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Distance Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="distance-threshold">Similarity threshold (miles)</Label>
              <Input
                id="distance-threshold"
                type="number"
                min="0"
                max="500"
                value={preferences.distanceThresholdMiles}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    distanceThresholdMiles: parseInt(e.target.value) || 50
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                How close loads need to be to be considered similar
              </p>
            </div>

            <div>
              <Label htmlFor="min-distance">Minimum distance (miles)</Label>
              <Input
                id="min-distance"
                type="number"
                min="0"
                value={preferences.minDistance}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    minDistance: parseInt(e.target.value) || 0
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="max-distance">Maximum distance (miles)</Label>
              <Input
                id="max-distance"
                type="number"
                min="0"
                value={preferences.maxDistance}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    maxDistance: parseInt(e.target.value) || 2000
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/* State Preferences */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Preferred States</h3>
          
          <div className="flex gap-2">
            <Input
              placeholder="Add state (e.g., CA, TX, NY)"
              value={newState}
              onChange={(e) => setNewState(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && addStatePreference()}
            />
            <Button onClick={addStatePreference} variant="outline">
              Add
            </Button>
          </div>

          {preferences.statePreferences.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferences.statePreferences.map((state) => (
                <div
                  key={state}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                >
                  {state}
                  <button
                    onClick={() => removeStatePreference(state)}
                    className="text-blue-300 hover:text-blue-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipment Preferences */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Preferred Equipment</h3>
          
          <div className="flex gap-2">
            <Input
              placeholder="Add equipment type (e.g., Dry Van, Flatbed)"
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addEquipmentPreference()}
            />
            <Button onClick={addEquipmentPreference} variant="outline">
              Add
            </Button>
          </div>

          {preferences.equipmentPreferences.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferences.equipmentPreferences.map((equipment) => (
                <div
                  key={equipment}
                  className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
                >
                  {equipment}
                  <button
                    onClick={() => removeEquipmentPreference(equipment)}
                    className="text-green-300 hover:text-green-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-6 border-t border-border/50">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className={accentBgStyle}
          >
            {isSaving ? (
              <>
                <Settings className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </Glass>
    </div>
  );
}
