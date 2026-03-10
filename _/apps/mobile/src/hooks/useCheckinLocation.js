import { useEffect, useState } from "react";
import * as Location from "expo-location";

export function useCheckinLocation() {
  const [deviceCoords, setDeviceCoords] = useState(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted) {
          return;
        }
        if (!perm?.granted) {
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) {
          return;
        }

        const lat = current?.coords?.latitude;
        const lng = current?.coords?.longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          setDeviceCoords({ lat, lng });
        }
      } catch (err) {
        console.error(err);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return deviceCoords;
}
