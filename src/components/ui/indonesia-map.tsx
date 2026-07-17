
'use client';

import * as React from 'react';
import { AdvancedMarker, Map, APIProvider } from '@vis.gl/react-google-maps';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProvinceData {
  users: User[];
  dominantUser?: User;
}

interface User {
  id: string;
  prideName: string;
  pride: number;
  province: string;
  role: 'admin' | 'user';
}

interface Title {
  id: string;
  name: string;
  prideRequired: number;
}

interface IndonesiaMapProps {
  users: User[];
  titles: Title[];
}

const provinceCoordinates: { [key: string]: { lat: number; lng: number } } = {
    "Aceh": { lat: 4.6951, lng: 96.7494 },
    "Sumatera Utara": { lat: 2.1154, lng: 99.5451 },
    "Sumatera Barat": { lat: -0.9471, lng: 100.3541 },
    "Riau": { lat: 0.2933, lng: 101.7068 },
    "Kepulauan Riau": { lat: 0.8207, lng: 104.4468 },
    "Jambi": { lat: -1.6101, lng: 103.6131 },
    "Bengkulu": { lat: -3.8004, lng: 102.2655 },
    "Sumatera Selatan": { lat: -3.3194, lng: 103.9141 },
    "Kepulauan Bangka Belitung": { lat: -2.7410, lng: 106.4405 },
    "Lampung": { lat: -4.5586, lng: 105.4068 },
    "Banten": { lat: -6.4058, lng: 106.0640 },
    "DKI Jakarta": { lat: -6.2088, lng: 106.8456 },
    "Jawa Barat": { lat: -6.9175, lng: 107.6191 },
    "Jawa Tengah": { lat: -7.1509, lng: 110.1402 },
    "DI Yogyakarta": { lat: -7.7956, lng: 110.3695 },
    "Jawa Timur": { lat: -7.5361, lng: 112.2384 },
    "Bali": { lat: -8.4095, lng: 115.1889 },
    "Nusa Tenggara Barat": { lat: -8.6529, lng: 117.3616 },
    "Nusa Tenggara Timur": { lat: -8.6574, lng: 121.0794 },
    "Kalimantan Barat": { lat: -0.0249, lng: 111.4789 },
    "Kalimantan Tengah": { lat: -1.6814, lng: 113.3824 },
    "Kalimantan Selatan": { lat: -3.0926, lng: 115.2838 },
    "Kalimantan Timur": { lat: 0.5387, lng: 116.4194 },
    "Kalimantan Utara": { lat: 3.0973, lng: 116.5183 },
    "Gorontalo": { lat: 0.6999, lng: 122.4467 },
    "Sulawesi Barat": { lat: -2.8441, lng: 119.2321 },
    "Sulawesi Selatan": { lat: -4.2105, lng: 120.2731 },
    "Sulawesi Tengah": { lat: -1.4300, lng: 121.4456 },
    "Sulawesi Tenggara": { lat: -4.1449, lng: 122.1746 },
    "Sulawesi Utara": { lat: 1.5427, lng: 124.7042 },
    "Maluku": { lat: -3.2384, lng: 130.1453 },
    "Maluku Utara": { lat: 0.6301, lng: 127.9720 },
    "Papua": { lat: -4.2247, lng: 138.0804 },
    "Papua Barat": { lat: -1.3361, lng: 133.1747 },
    "Papua Barat Daya": { lat: -1.2829, lng: 131.1419 },
    "Papua Pegunungan": { lat: -4.0435, lng: 138.8773 },
    "Papua Selatan": { lat: -7.0949, lng: 139.5204 },
    "Papua Tengah": { lat: -3.9868, lng: 136.2255 },
    "Luar Negeri": { lat: -5, lng: 145 },
};

const getTitleForPride = (pride: number, titles: Title[]): Title | null => {
  if (!titles) return null;
  return [...titles]
    .sort((a, b) => b.prideRequired - a.prideRequired)
    .find(t => pride >= t.prideRequired) || null;
};

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function IndonesiaMap({ users, titles }: IndonesiaMapProps) {
  const provinceData = React.useMemo(() => {
    const data: { [key: string]: ProvinceData } = {};

    for (const provinceName in provinceCoordinates) {
        data[provinceName] = { users: [] };
    }

    users.forEach(user => {
      // Pastikan hanya user biasa yang dihitung
      if (user.role !== 'admin' && data[user.province]) {
        data[user.province].users.push(user);
      }
    });

    for (const provinceName in data) {
      if (data[provinceName].users.length > 0) {
        data[provinceName].users.sort((a, b) => b.pride - a.pride);
        data[provinceName].dominantUser = data[provinceName].users[0];
      }
    }
    return data;
  }, [users]);
  
  const mapCenter = { lat: -2.5489, lng: 118.0149 };
  
  if (!API_KEY) {
      console.error("Google Maps API Key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.");
      return <div className="flex items-center justify-center w-full h-[600px] bg-muted text-destructive-foreground">Kunci API Google Maps tidak ditemukan.</div>;
  }

  return (
    <APIProvider apiKey={API_KEY}>
        <TooltipProvider>
        <div className="w-full h-[600px]">
            <Map
            defaultCenter={mapCenter}
            defaultZoom={4.5}
            mapId="FADE_TO_BLACK_MAP"
            mapTypeId="satellite"
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            >
            {Object.entries(provinceData).map(([provinceName, data]) => {
                const coords = provinceCoordinates[provinceName];
                if (!coords) return null;

                const ruler = data.dominantUser;
                const rulerTitle = ruler ? getTitleForPride(ruler.pride, titles) : null;
                
                const MarkerComponent = () => (
                    <div className="relative cursor-pointer">
                    {ruler ? (
                        <>
                        <div className="absolute -inset-1.5 bg-primary/30 rounded-full animate-pulse"></div>
                        <div className="relative w-3 h-3 rounded-full bg-primary border border-primary-foreground"></div>
                        </>
                    ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50"></div>
                    )}
                    </div>
                );

                return (
                    <Tooltip key={provinceName}>
                    <TooltipTrigger asChild>
                        <AdvancedMarker position={coords}>
                        <MarkerComponent />
                        </AdvancedMarker>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="text-center p-1">
                        <p className="font-bold text-lg">{provinceName}</p>
                        {ruler ? (
                            <>
                            <p className="text-primary text-md">
                                Dikuasai oleh: {ruler.prideName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {rulerTitle?.name || 'Tanpa Gelar'}
                            </p>
                            <p className="font-mono text-xs">
                                Pride: {ruler.pride.toLocaleString()}
                            </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Belum Dikuasai</p>
                        )}
                        </div>
                    </TooltipContent>
                    </Tooltip>
                );
                })}
            </Map>
        </div>
        </TooltipProvider>
    </APIProvider>
  );
}
