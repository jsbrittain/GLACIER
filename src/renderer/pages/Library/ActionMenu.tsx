import React, { useState } from 'react';
import { Button, Box, Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import QueryAddCatalogueDialog from './QueryAddCatalogueDialog';
import QueryAddWorkflowDialog from './QueryAddWorkflowDialog';
import QueryImportShardDialog from './QueryImportShardDialog';
import { API } from '../../services/api.js';

export default function ActionMenu({
  setCatalogues,
  permitAddCatalogues,
  permitImportShards,
  permitAddRepos,
  logMessage
}) {
  const { t } = useTranslation();
  const [showQueryCatalogueDialog, setShowQueryCatalogueDialog] = useState(false);
  const [showQueryImportShardDialog, setShowQueryImportShardDialog] = useState(false);
  const [showQueryRepositoryDialog, setShowQueryRepositoryDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuIsOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDialogClose = () => {
    setShowQueryCatalogueDialog(false);
    setShowQueryImportShardDialog(false);
    setShowQueryRepositoryDialog(false);
    handleMenuClose();
  };

  const getCatalogues = async () => {
    return API.getCatalogues().then((result) => {
      if (result.ok) {
        setCatalogues(result.data);
      } else {
        throw new Error(result.error.message);
      }
    });
  }

  const addCatalogue = async (repo, version) => {
    return API.addCatalogue(repo, version).then((result) => {
      if (result.ok) {
        return getCatalogues();
      } else {
        throw new Error(result.error.message);
      }
    });
  };

  const addUserWorkflow = async (name, url, version, section) => {
    return API.addUserWorkflow(name, url, version, section).then((result) => {
      if (result.ok) {
        return getCatalogues();
      } else {
        throw new Error(result.error.message);
      }
    });
    handleDialogClose();
  };
  
  const display = permitAddCatalogues || permitAddRepos;
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        mb: 2
      }}
    >
      {display && (
        <>
          <Button id="library-actions-menu-button" variant="contained" onClick={handleMenuOpen}>
            {t('library.actions')}
          </Button>
          <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
            {permitAddCatalogues && (
              <MenuItem
                onClick={() => setShowQueryCatalogueDialog(true)}
                disabled={!permitAddCatalogues}
              >
                {t('library.add-catalogue')}
              </MenuItem>
            )}
            {permitImportShards && (
              <MenuItem
                id="library-actions-menu-import-shard"
                onClick={() => setShowQueryImportShardDialog(true)}
                disabled={!permitImportShards}
              >
                {t('library.import-shard')}
              </MenuItem>
            )}
            {permitAddRepos && (
              <MenuItem
                id="library-actions-menu-add-repo"
                onClick={() => setShowQueryRepositoryDialog(true)}
                disabled={!permitAddRepos}
              >
                {t('library.add-repository')}
              </MenuItem>
            )}
          </Menu>
          <QueryAddCatalogueDialog
            open={showQueryCatalogueDialog}
            action={addCatalogue}
            onClose={handleDialogClose}
          />
          <QueryImportShardDialog
            open={showQueryImportShardDialog}
            onClose={handleDialogClose}
            refresh={getCatalogues}
            logMessage={logMessage}
          />
          <QueryAddWorkflowDialog
            open={showQueryRepositoryDialog}
            action={addUserWorkflow}
            onClose={handleDialogClose}
          />
        </>
      )}
    </Box>
  );
}
