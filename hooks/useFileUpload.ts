"use client";

import { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";

export interface UploadFile {
  id: string;
  file: File | null;
  name: string;
  size: number;
  duration: number | null;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  storagePath?: string;
}

interface UseFileUploadReturn {
  files: UploadFile[];
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  renameFile: (id: string, name: string) => void;
  reorderFiles: (fromIndex: number, toIndex: number) => void;
  setInitialFiles: (files: UploadFile[]) => void;
  uploadAll: (userId: string, accessToken: string) => Promise<UploadFile[]>;
  retryFile: (id: string, userId: string, accessToken: string) => Promise<void>;
  isUploading: boolean;
  overallProgress: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB

export function useFileUpload(): UseFileUploadReturn {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadsRef = useRef<Map<string, tus.Upload>>(new Map());

  const overallProgress =
    files.length === 0
      ? 0
      : Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(incoming).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      duration: null,
      progress: 0,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    // Extract durations asynchronously
    newFiles.forEach((uf) => {
      if (!uf.file) return;
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const dur = isFinite(audio.duration) ? audio.duration : null;
        setFiles((prev) =>
          prev.map((f) => (f.id === uf.id ? { ...f, duration: dur } : f))
        );
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(uf.file);
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    const upload = uploadsRef.current.get(id);
    if (upload) {
      upload.abort();
      uploadsRef.current.delete(id);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const renameFile = useCallback((id: string, name: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f))
    );
  }, []);

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const setInitialFiles = useCallback((initial: UploadFile[]) => {
    setFiles(initial);
  }, []);

  const uploadSingleFile = useCallback(
    (uploadFile: UploadFile, userId: string, accessToken: string): Promise<UploadFile> => {
      return new Promise((resolve, reject) => {
        if (!uploadFile.file) {
          reject(new Error("No file to upload"));
          return;
        }

        const storagePath = `${userId}/${uploadFile.id}-${uploadFile.name}`;

        const upload = new tus.Upload(uploadFile.file, {
          endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 1000, 3000, 5000],
          chunkSize: CHUNK_SIZE,
          removeFingerprintOnSuccess: true,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-upsert": "false",
          },
          metadata: {
            bucketName: "party-audio",
            objectName: storagePath,
            contentType: uploadFile.file.type,
            cacheControl: "3600",
          },
          onProgress(bytesUploaded, bytesTotal) {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, progress: pct, status: "uploading" } : f
              )
            );
          },
          onError(err) {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? { ...f, status: "error", error: err.message }
                  : f
              )
            );
            reject(err);
          },
          onSuccess() {
            const completed: UploadFile = {
              ...uploadFile,
              progress: 100,
              status: "complete",
              storagePath,
            };
            setFiles((prev) =>
              prev.map((f) => (f.id === uploadFile.id ? completed : f))
            );
            uploadsRef.current.delete(uploadFile.id);
            resolve(completed);
          },
        });

        uploadsRef.current.set(uploadFile.id, upload);
        upload.start();
      });
    },
    []
  );

  const uploadAll = useCallback(
    async (userId: string, accessToken: string): Promise<UploadFile[]> => {
      setIsUploading(true);
      const results: UploadFile[] = [];

      // Upload sequentially to avoid bandwidth competition
      for (const file of files) {
        if (file.status === "complete") {
          results.push(file);
          continue;
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "uploading", progress: 0 } : f
          )
        );

        try {
          const result = await uploadSingleFile(file, userId, accessToken);
          results.push(result);
        } catch {
          // File marked as error in onError callback, continue with rest
          results.push({ ...file, status: "error" });
        }
      }

      setIsUploading(false);
      return results;
    },
    [files, uploadSingleFile]
  );

  const retryFile = useCallback(
    async (id: string, userId: string, accessToken: string): Promise<void> => {
      const file = files.find((f) => f.id === id);
      if (!file) return;

      setIsUploading(true);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: "uploading", progress: 0, error: undefined } : f
        )
      );

      try {
        await uploadSingleFile(file, userId, accessToken);
      } catch {
        // Error handled in onError callback
      }

      setIsUploading(false);
    },
    [files, uploadSingleFile]
  );

  return {
    files,
    addFiles,
    removeFile,
    renameFile,
    reorderFiles,
    setInitialFiles,
    uploadAll,
    retryFile,
    isUploading,
    overallProgress,
  };
}
