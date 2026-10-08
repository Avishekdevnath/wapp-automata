import React from 'react';
import { useUI } from '../../context/UIContext';
import { DeviceModal } from './DeviceModal';
import { StorageModal } from './StorageModal';
import { DataManagementModal } from './DataManagementModal';
import { RouteDetailModal, type RouteDetailItem } from './RouteDetailModal';
import { PostRouteModal } from './PostRouteModal';
import { AiSettingsModal } from './AiSettingsModal';
import { ShortcutsModal } from './ShortcutsModal';
import { MessageDetailModal } from './MessageDetailModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { DeviceStatus } from '../../types/status';
import type { WhatsAppMessage } from '../../types/message';

interface ModalRootProps {
  deviceStatus: DeviceStatus;
  onRefreshStatus: () => void;
  onDeleteConfirm: (percentage?: number) => Promise<boolean>;
  onPostRoute: (route: Partial<RouteDetailItem>) => Promise<boolean>;
}

export const ModalRoot: React.FC<ModalRootProps> = ({
  deviceStatus,
  onRefreshStatus,
  onDeleteConfirm,
  onPostRoute,
}) => {
  const { activeModal, modalPayload, closeModal, openModal, switchView } = useUI();

  return (
    <>
      <DeviceModal
        isOpen={activeModal === 'device'}
        onClose={closeModal}
        deviceStatus={deviceStatus}
        onRefresh={onRefreshStatus}
      />

      <StorageModal
        isOpen={activeModal === 'storage'}
        onClose={closeModal}
        onOpenDataManagement={(target) => openModal('data-management', target)}
      />

      <DataManagementModal
        isOpen={activeModal === 'data-management'}
        onClose={closeModal}
        target={(modalPayload as 'routes' | 'analysis' | 'news' | 'all') || 'routes'}
      />

      <RouteDetailModal
        route={activeModal === 'route-detail' ? (modalPayload as RouteDetailItem) : null}
        onClose={closeModal}
        onPitch={() => {
          closeModal();
          switchView('insights');
        }}
      />

      <PostRouteModal
        isOpen={activeModal === 'post-route'}
        onClose={closeModal}
        onPostRoute={onPostRoute}
      />

      <AiSettingsModal
        isOpen={activeModal === 'ai-settings'}
        onClose={closeModal}
      />

      <ShortcutsModal
        isOpen={activeModal === 'shortcuts'}
        onClose={closeModal}
      />

      <MessageDetailModal
        message={activeModal === 'message-detail' ? (modalPayload as WhatsAppMessage) : null}
        onClose={closeModal}
      />

      <DeleteConfirmModal
        isOpen={activeModal === 'delete'}
        onClose={closeModal}
        onConfirm={onDeleteConfirm}
      />
    </>
  );
};
