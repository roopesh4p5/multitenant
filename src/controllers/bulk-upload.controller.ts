import { Request, Response } from 'express';
import { processBulkUpload, getErrorReportStream } from '../services/bulk-upload.service';

export const bulkUploadEmployees = async (req: Request, res: Response): Promise<void> => {
  console.log('[bulkUploadEmployees] start');
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'Excel file is required. Please upload a file with key name "file".',
    });
    return;
  }

  try {
    if (!req.user?.tenantId) {
      res.status(403).json({
        success: false,
        message: 'Tenant access required.',
      });
      return;
    }

    const result = await processBulkUpload(req.file.buffer, req.user.tenantId);
    console.log('[bulkUploadEmployees] done', {
      tenantId: req.user.tenantId,
      totalRows: result.totalRows,
      successCount: result.successCount,
      errorCount: result.errorCount,
      errorReportId: result.errorReportId,
    });

    res.status(200).json({
      success: true,
      message: 'Bulk upload completed.',
      data: result,
    });
  } catch (err: any) {
    console.error('[bulkUploadEmployees]', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error during bulk upload.',
    });
  }
};


export const downloadErrorReport = async (req: Request, res: Response): Promise<void> => {
  const reportId = String(req.params.reportId);
  console.log('[downloadErrorReport] reportId', reportId);

  if (!reportId) {
    res.status(400).json({
      success: false,
      message: 'Report ID is required.',
    });
    return;
  }

  try {
    const reportStream = await getErrorReportStream(reportId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-upload-errors-${reportId}.xlsx"`);

    if (typeof reportStream.pipe === 'function') {
      reportStream.pipe(res);
      return;
    }

    res.send(reportStream);
  } catch (err: any) {
    console.log('[downloadErrorReport] error', err.message || err);
    if (err.message === 'REPORT_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Error report not found or expired.',
      });
      return;
    }
    console.error('[downloadErrorReport]', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error while downloading report.',
    });
  }
};
