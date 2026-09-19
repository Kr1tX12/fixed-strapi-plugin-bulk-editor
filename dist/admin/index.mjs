import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { Modal, Box, Typography, Table, Thead, Tr, Th, Tbody, Td, Button, DesignSystemProvider } from "@strapi/design-system";
import { Pencil } from "@strapi/icons";
import { useNotification, useFetchClient } from "@strapi/strapi/admin";
import { useState, useEffect } from "react";
const BulkEditModal = ({
  documents,
  contentType,
  onClose,
  notificationFn,
  fetchClient
}) => {
  const [editedEntries, setEditedEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [relationOptions, setRelationOptions] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [populatingRelations, setPopulatingRelations] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedCells, setSelectedCells] = useState(/* @__PURE__ */ new Set());
  const getCellKey = (docId, field) => `${docId}:${field}`;
  useEffect(() => {
    const fetchSchema = async () => {
      setSchemaLoading(true);
      try {
        const configResponse = await fetchClient.get(`/content-manager/content-types/${contentType}/configuration`);
        const builderResponse = await fetchClient.get(`/content-type-builder/content-types/${contentType}`);
        let schemaData = null;
        if (builderResponse.data?.data?.schema?.attributes) {
          const rawSchema = builderResponse.data.data.schema;
          schemaData = {
            attributes: rawSchema.attributes,
            pluralName: rawSchema.pluralName,
            options: {
              draftAndPublish: rawSchema.draftAndPublish || rawSchema.options?.draftAndPublish || false
            }
          };
        } else if (builderResponse.data?.schema?.attributes) {
          const rawSchema = builderResponse.data.schema;
          schemaData = {
            attributes: rawSchema.attributes,
            pluralName: rawSchema.pluralName,
            options: {
              draftAndPublish: rawSchema.draftAndPublish || rawSchema.options?.draftAndPublish || false
            }
          };
        } else if (configResponse.data?.data?.contentType?.attributes) {
          const rawSchema = configResponse.data.data.contentType;
          schemaData = {
            attributes: rawSchema.attributes,
            pluralName: rawSchema.pluralName,
            options: {
              draftAndPublish: rawSchema.draftAndPublish || rawSchema.options?.draftAndPublish || false
            }
          };
        } else if (configResponse.data?.data?.schema?.attributes) {
          const rawSchema = configResponse.data.data.schema;
          schemaData = {
            attributes: rawSchema.attributes,
            pluralName: rawSchema.pluralName,
            options: {
              draftAndPublish: rawSchema.draftAndPublish || rawSchema.options?.draftAndPublish || false
            }
          };
        } else if (configResponse.data?.contentType?.attributes) {
          const rawSchema = configResponse.data.contentType;
          schemaData = {
            attributes: rawSchema.attributes,
            pluralName: rawSchema.pluralName,
            options: {
              draftAndPublish: rawSchema.draftAndPublish || rawSchema.options?.draftAndPublish || false
            }
          };
        }
        if (schemaData) {
          setSchema(schemaData);
        }
      } catch (error) {
        console.error("Failed to fetch schema:", error);
      } finally {
        setSchemaLoading(false);
      }
    };
    fetchSchema();
  }, [contentType, fetchClient]);
  useEffect(() => {
    const fetchRelationOptions = async () => {
      if (!schema) return;
      const relationFields = Object.entries(schema.attributes || {}).filter(([_, fieldSchema]) => fieldSchema.type === "relation").map(([fieldName, fieldSchema]) => ({ fieldName, fieldSchema }));
      if (relationFields.length === 0) return;
      const options = {};
      for (const { fieldName, fieldSchema } of relationFields) {
        try {
          const targetContentType = fieldSchema.target;
          if (!targetContentType) continue;
          const response = await fetchClient.get(
            `/content-manager/collection-types/${targetContentType}?page=1&pageSize=100`
          );
          if (response.data?.results) {
            options[fieldName] = response.data.results;
          }
        } catch (error) {
        }
      }
      setRelationOptions(options);
    };
    fetchRelationOptions();
  }, [schema, fetchClient]);
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragStart) {
        handleDragEnd();
      }
    };
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [dragStart, dragCurrent]);
  useEffect(() => {
    const populateRelations = async () => {
      if (!schema || documents.length === 0) return;
      setPopulatingRelations(true);
      const docIdsNeedingPopulation = [];
      documents.forEach((doc) => {
        const docId = doc.documentId || doc.id;
        if (!docId) return;
        Object.keys(doc).forEach((key) => {
          const isRelationField = schema.attributes?.[key]?.type === "relation";
          if (isRelationField && typeof doc[key] === "object" && doc[key] !== null && "count" in doc[key]) {
            if (!docIdsNeedingPopulation.includes(docId)) {
              docIdsNeedingPopulation.push(docId);
            }
          }
        });
      });
      if (docIdsNeedingPopulation.length > 0) {
        try {
          const response = await fetchClient.post("/bulk-editor/get-populated", {
            contentType,
            documentIds: docIdsNeedingPopulation
          });
          const populatedDocs = response.data?.documents || [];
          const updatedDocuments = documents.map((doc) => {
            const docId = doc.documentId || doc.id;
            const populated = populatedDocs.find((pd) => (pd.documentId || pd.id) === docId);
            return populated || doc;
          });
          initializeEntries(updatedDocuments);
        } catch (error) {
          initializeEntries(documents);
        }
      } else {
        initializeEntries(documents);
      }
    };
    const initializeEntries = (docs) => {
      const initial = {};
      docs.forEach((doc) => {
        const docId = doc.documentId || doc.id;
        if (docId) {
          const docCopy = { ...doc };
          Object.keys(docCopy).forEach((key) => {
            if (Array.isArray(docCopy[key])) {
              docCopy[key] = [...docCopy[key]];
            } else if (typeof docCopy[key] === "object" && docCopy[key] !== null && "count" in docCopy[key]) {
              docCopy[key] = [];
            }
          });
          if (schema?.attributes) {
            Object.entries(schema.attributes).forEach(([key, fieldSchema]) => {
              if (fieldSchema.type === "relation") {
                if (!(key in docCopy) || docCopy[key] === void 0) {
                  const relationField = fieldSchema;
                  const isManyRelation = relationField.relation?.includes("ToMany") || relationField.relation === "manyToMany";
                  docCopy[key] = isManyRelation ? [] : null;
                }
              }
            });
          }
          initial[docId] = docCopy;
        }
      });
      setEditedEntries(initial);
      setPopulatingRelations(false);
    };
    populateRelations();
  }, [documents, schema, contentType, fetchClient]);
  const getEditableFields = () => {
    if (documents.length === 0) return [];
    const doc = documents[0];
    const excludeFields = [
      "id",
      "documentId",
      "createdAt",
      "updatedAt",
      "publishedAt",
      "createdBy",
      "updatedBy",
      "locale",
      "localizations",
      "status"
    ];
    return Object.keys(doc).filter((key) => {
      const value = doc[key];
      if (excludeFields.includes(key)) return false;
      if (schema?.attributes?.[key]) {
        const fieldSchema = schema.attributes[key];
        if (fieldSchema.type === "component" || fieldSchema.type === "dynamiczone") {
          return false;
        }
        return true;
      }
      if (typeof value === "object" && value !== null) return false;
      if (Array.isArray(value)) return false;
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null || value === void 0;
    });
  };
  const fields = getEditableFields();
  const getFieldType = (field) => {
    return schema?.attributes?.[field] || null;
  };
  const handleFieldChange = (docId, field, value) => {
    const cellKey = getCellKey(String(docId), field);
    const cellsToUpdate = /* @__PURE__ */ new Set();
    cellsToUpdate.add(cellKey);
    selectedCells.forEach((selectedKey) => {
      const [, selectedField] = selectedKey.split(":");
      if (selectedField === field) {
        cellsToUpdate.add(selectedKey);
      }
    });
    setEditedEntries((prev) => {
      const updated = { ...prev };
      cellsToUpdate.forEach((key) => {
        const [targetDocId] = key.split(":");
        updated[targetDocId] = {
          ...updated[targetDocId],
          [field]: value
        };
      });
      return updated;
    });
    setHasUnsavedChanges(true);
  };
  const handleManyToManyChange = (docId, field, itemId, operation) => {
    const cellKey = getCellKey(String(docId), field);
    const cellsToUpdate = /* @__PURE__ */ new Set();
    cellsToUpdate.add(cellKey);
    selectedCells.forEach((selectedKey) => {
      const [, selectedField] = selectedKey.split(":");
      if (selectedField === field) {
        cellsToUpdate.add(selectedKey);
      }
    });
    setEditedEntries((prev) => {
      const updated = { ...prev };
      cellsToUpdate.forEach((key) => {
        const [targetDocId] = key.split(":");
        const currentValue = updated[targetDocId]?.[field];
        const currentIds = Array.isArray(currentValue) ? currentValue.map(
          (item) => typeof item === "object" && item?.id ? item.id : typeof item === "number" ? item : null
        ).filter((id) => id !== null) : [];
        let newIds;
        if (operation === "add") {
          newIds = currentIds.includes(itemId) ? currentIds : [...currentIds, itemId];
        } else {
          newIds = currentIds.filter((id) => id !== itemId);
        }
        updated[targetDocId] = {
          ...updated[targetDocId],
          [field]: newIds
        };
      });
      return updated;
    });
    setHasUnsavedChanges(true);
  };
  const handleCellClick = (e, docId, field) => {
    const cellKey = getCellKey(docId, field);
    const docIds = documents.map((doc) => doc.documentId || doc.id).filter(Boolean);
    const isThisCellSelected = selectedCells.has(cellKey);
    const target = e.target;
    const tagName = target.tagName.toLowerCase();
    const isInteractiveElement = tagName === "input" || tagName === "select" || tagName === "button" || tagName === "option";
    if (e.shiftKey) {
      e.preventDefault();
      setSelectedCells((prev) => {
        const newSet = /* @__PURE__ */ new Set();
        let lastSelectedIndex = -1;
        prev.forEach((key) => {
          const [keyDocId, keyField] = key.split(":");
          if (keyField === field) {
            const idx = docIds.indexOf(keyDocId);
            if (idx > lastSelectedIndex) {
              lastSelectedIndex = idx;
            }
          }
        });
        prev.forEach((key) => {
          const [, keyField] = key.split(":");
          if (keyField === field) {
            newSet.add(key);
          }
        });
        const currentIndex = docIds.indexOf(docId);
        if (lastSelectedIndex !== -1 && currentIndex !== -1) {
          const [minIndex, maxIndex] = [Math.min(lastSelectedIndex, currentIndex), Math.max(lastSelectedIndex, currentIndex)];
          for (let i = minIndex; i <= maxIndex; i++) {
            newSet.add(getCellKey(docIds[i], field));
          }
        } else {
          newSet.add(cellKey);
        }
        return newSet;
      });
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      setSelectedCells((prev) => {
        const newSet = /* @__PURE__ */ new Set();
        prev.forEach((key) => {
          const [, keyField] = key.split(":");
          if (keyField === field) {
            newSet.add(key);
          }
        });
        if (newSet.has(cellKey)) {
          newSet.delete(cellKey);
        } else {
          newSet.add(cellKey);
        }
        return newSet;
      });
    } else if (isInteractiveElement && isThisCellSelected) {
      return;
    } else {
      setSelectedCells(/* @__PURE__ */ new Set([cellKey]));
    }
  };
  const handleDragStart = (e, docId, field) => {
    e.preventDefault();
    setDragStart({ docId, field });
    setDragCurrent({ docId, field });
  };
  const handleDragOver = (docId, field) => {
    if (dragStart && dragStart.field === field) {
      setDragCurrent({ docId, field });
    }
  };
  const handleDragEnd = () => {
    if (dragStart && dragCurrent && dragStart.field === dragCurrent.field) {
      const docIds = documents.map((doc) => doc.documentId || doc.id).filter(Boolean);
      const startIndex = docIds.indexOf(dragStart.docId);
      const endIndex = docIds.indexOf(dragCurrent.docId);
      if (startIndex !== -1 && endIndex !== -1) {
        const [minIndex, maxIndex] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
        const affectedDocIds = docIds.slice(minIndex, maxIndex + 1);
        setEditedEntries((prev) => {
          let sourceValue = prev[dragStart.docId]?.[dragStart.field];
          const fieldSchema = getFieldType(dragStart.field);
          if (fieldSchema?.type === "relation") {
            const relationField = fieldSchema;
            const isManyRelation = relationField.relation?.includes("ToMany") || relationField.relation?.includes("manyToMany");
            if (isManyRelation) {
              if (Array.isArray(sourceValue)) {
                sourceValue = sourceValue.map(
                  (item) => typeof item === "object" && item?.id ? item.id : typeof item === "number" ? item : null
                ).filter((id) => id !== null);
              } else {
                sourceValue = [];
              }
            } else {
              if (typeof sourceValue === "object" && sourceValue?.id) {
                sourceValue = sourceValue.id;
              }
            }
          }
          const updated = { ...prev };
          affectedDocIds.forEach((docId) => {
            updated[docId] = {
              ...updated[docId],
              [dragStart.field]: sourceValue
            };
          });
          return updated;
        });
        setHasUnsavedChanges(true);
      }
    }
    setDragStart(null);
    setDragCurrent(null);
  };
  const isInDragSelection = (docId, field) => {
    if (!dragStart || !dragCurrent || dragStart.field !== field) return false;
    const docIds = documents.map((doc) => doc.documentId || doc.id).filter(Boolean);
    const startIndex = docIds.indexOf(dragStart.docId);
    const currentIndex = docIds.indexOf(dragCurrent.docId);
    const thisIndex = docIds.indexOf(docId);
    const [minIndex, maxIndex] = [Math.min(startIndex, currentIndex), Math.max(startIndex, currentIndex)];
    return thisIndex >= minIndex && thisIndex <= maxIndex;
  };
  const isCellSelected = (docId, field) => {
    return selectedCells.has(getCellKey(docId, field));
  };
  const renderFieldInput = (docId, field, value, fieldSchema, isLoading) => {
    const onChange = (newValue) => handleFieldChange(docId, field, newValue);
    const disabledStyle = isLoading ? {
      opacity: 0.5,
      pointerEvents: "none",
      backgroundColor: "#f6f6f9"
    } : {};
    if (fieldSchema?.type === "relation") {
      const options = relationOptions[field] || [];
      const relationField = fieldSchema;
      const isManyRelation = relationField.relation?.includes("ToMany") || relationField.relation?.includes("manyToMany");
      if (isManyRelation) {
        const selectedIds = Array.isArray(value) ? value.map((item) => typeof item === "object" && item?.id ? item.id : typeof item === "number" ? item : null).filter((id) => id !== null) : [];
        const selectedItems = options.filter(
          (opt) => selectedIds.includes(opt.id)
        );
        return /* @__PURE__ */ jsxs("div", { style: { width: "100%", minWidth: "150px", ...disabledStyle }, children: [
          selectedItems.length > 0 && /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                marginBottom: "4px"
              },
              children: selectedItems.map((item) => /* @__PURE__ */ jsxs(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 6px",
                    backgroundColor: "#e0f2ff",
                    border: "1px solid #4945ff",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#4945ff"
                  },
                  children: [
                    item.title || item.name || `#${item.id}`,
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => {
                          handleManyToManyChange(docId, field, item.id, "remove");
                        },
                        style: {
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "14px",
                          color: "#4945ff",
                          fontWeight: "bold"
                        },
                        children: "×"
                      }
                    )
                  ]
                },
                item.documentId || item.id
              ))
            }
          ),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: "",
              onChange: (e) => {
                const selectedId = e.target.value ? parseInt(e.target.value, 10) : null;
                if (selectedId) {
                  handleManyToManyChange(docId, field, selectedId, "add");
                }
              },
              style: {
                width: "100%",
                padding: "8px",
                border: "1px solid #dcdce4",
                borderRadius: "4px",
                fontSize: "14px",
                backgroundColor: isLoading ? "#f6f6f9" : "white",
                cursor: "default"
              },
              disabled: isLoading,
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "+ Add..." }),
                options.filter((opt) => !selectedIds.includes(opt.id)).map((option) => /* @__PURE__ */ jsx("option", { value: option.id, children: option.title || option.name || `#${option.id}` }, option.documentId || option.id))
              ]
            }
          )
        ] });
      }
      const currentValue = typeof value === "object" && value?.id ? value.id : typeof value === "number" ? value : "";
      return /* @__PURE__ */ jsxs(
        "select",
        {
          value: currentValue,
          onChange: (e) => {
            const selectedId = e.target.value ? parseInt(e.target.value, 10) : null;
            onChange(selectedId);
          },
          style: {
            width: "100%",
            minWidth: "120px",
            padding: "8px",
            border: "1px solid #dcdce4",
            borderRadius: "4px",
            fontSize: "14px",
            backgroundColor: isLoading ? "#f6f6f9" : "white",
            cursor: "default",
            ...disabledStyle
          },
          disabled: isLoading,
          children: [
            /* @__PURE__ */ jsx("option", { value: "" }),
            options.map((option) => /* @__PURE__ */ jsx("option", { value: option.id, children: option.title || option.name || `#${(option.documentId || option.id).slice(0, 8)}` }, option.documentId || option.id))
          ]
        }
      );
    }
    if (fieldSchema?.type === "enumeration" && fieldSchema.enum) {
      return /* @__PURE__ */ jsxs(
        "select",
        {
          value: value ?? "",
          onChange: (e) => onChange(e.target.value || null),
          style: {
            width: "100%",
            minWidth: "120px",
            padding: "8px",
            border: "1px solid #dcdce4",
            borderRadius: "4px",
            fontSize: "14px",
            backgroundColor: isLoading ? "#f6f6f9" : "white",
            cursor: "default",
            ...disabledStyle
          },
          disabled: isLoading,
          children: [
            /* @__PURE__ */ jsx("option", { value: "" }),
            fieldSchema.enum.map((option) => /* @__PURE__ */ jsx("option", { value: option, children: option }, option))
          ]
        }
      );
    }
    if (fieldSchema?.type === "media") {
      const mediaUrl = typeof value === "object" && value?.url ? value.url : typeof value === "string" ? value : null;
      return /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#f6f6f9",
            border: "1px solid #dcdce4",
            overflow: "hidden",
            margin: "0 auto",
            ...disabledStyle
          },
          children: mediaUrl ? /* @__PURE__ */ jsx(
            "img",
            {
              src: mediaUrl,
              alt: "Preview",
              style: {
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }
            }
          ) : /* @__PURE__ */ jsx(Typography, { variant: "pi", textColor: "neutral400", children: "—" })
        }
      );
    }
    if (fieldSchema?.type === "boolean" || typeof value === "boolean") {
      return /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            ...disabledStyle
          },
          children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              checked: value || false,
              onChange: (e) => onChange(e.target.checked),
              style: {
                width: "20px",
                height: "20px",
                cursor: isLoading ? "default" : "pointer"
              },
              disabled: isLoading
            }
          )
        }
      );
    }
    if (fieldSchema?.type === "date" || fieldSchema?.type === "datetime") {
      const dateValue = value ? new Date(value).toISOString().slice(0, 10) : "";
      return /* @__PURE__ */ jsx(
        "input",
        {
          type: "date",
          value: dateValue,
          onChange: (e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null),
          style: {
            width: "100%",
            minWidth: "140px",
            padding: "8px",
            border: "1px solid #dcdce4",
            borderRadius: "4px",
            fontSize: "14px",
            backgroundColor: isLoading ? "#f6f6f9" : "white",
            ...disabledStyle
          },
          disabled: isLoading
        }
      );
    }
    if (fieldSchema?.type === "integer" || fieldSchema?.type === "biginteger" || fieldSchema?.type === "decimal" || fieldSchema?.type === "float" || typeof value === "number") {
      return /* @__PURE__ */ jsx(
        "input",
        {
          type: "number",
          value: value ?? "",
          onChange: (e) => {
            const parsed = parseFloat(e.target.value);
            onChange(isNaN(parsed) ? null : parsed);
          },
          step: fieldSchema?.type === "decimal" || fieldSchema?.type === "float" ? "0.01" : "1",
          style: {
            width: "100%",
            minWidth: "120px",
            padding: "8px",
            border: "1px solid #dcdce4",
            borderRadius: "4px",
            fontSize: "14px",
            backgroundColor: isLoading ? "#f6f6f9" : "white",
            ...disabledStyle
          },
          disabled: isLoading
        }
      );
    }
    return /* @__PURE__ */ jsx(
      "input",
      {
        type: "text",
        value: value ?? "",
        onChange: (e) => onChange(e.target.value),
        style: {
          width: "100%",
          minWidth: "120px",
          padding: "8px",
          border: "1px solid #dcdce4",
          borderRadius: "4px",
          fontSize: "14px",
          backgroundColor: isLoading ? "#f6f6f9" : "white",
          ...disabledStyle
        },
        disabled: isLoading
      }
    );
  };
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };
  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };
  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };
  const handleSave = async (shouldPublish = false) => {
    setSaving(true);
    try {
      const updates = Object.entries(editedEntries).map(([id, data]) => {
        const cleanData = {};
        const excludeFields = [
          "id",
          "documentId",
          "createdAt",
          "updatedAt",
          "publishedAt",
          "createdBy",
          "updatedBy",
          "locale",
          "localizations",
          "status"
        ];
        fields.forEach((field) => {
          if (field in data && !excludeFields.includes(field)) {
            let value = data[field];
            const fieldSchema = getFieldType(field);
            if (fieldSchema?.type === "media") {
              return;
            }
            if (fieldSchema?.type === "relation") {
              const relationField = fieldSchema;
              const isManyRelation = relationField.relation?.includes("ToMany") || relationField.relation?.includes("manyToMany");
              if (isManyRelation) {
                if (Array.isArray(value)) {
                  value = value.map(
                    (item) => typeof item === "object" && item?.id ? item.id : typeof item === "number" ? item : null
                  ).filter((id2) => id2 !== null);
                } else {
                  value = [];
                }
              } else {
                if (typeof value === "object" && value?.id) {
                  value = value.id;
                }
                if (value === "" || value === null || value === void 0) {
                  value = null;
                }
              }
            }
            cleanData[field] = value;
          }
        });
        return {
          id,
          data: cleanData
        };
      });
      const response = await fetchClient.post("/bulk-editor/bulk-update", {
        contentType,
        updates,
        publish: shouldPublish
      });
      if (response.data?.success) {
        const successCount = response.data.results.filter((r) => r.success).length;
        const failCount = response.data.results.filter((r) => !r.success).length;
        const action = shouldPublish ? "Published" : "Updated";
        if (notificationFn && typeof notificationFn.toggleNotification === "function") {
          notificationFn.toggleNotification({
            type: successCount === updates.length ? "success" : "warning",
            message: `${action} ${successCount} entries${failCount > 0 ? `, ${failCount} failed` : ""}`
          });
        } else if (typeof notificationFn === "function") {
          notificationFn({
            type: successCount === updates.length ? "success" : "warning",
            message: `${action} ${successCount} entries${failCount > 0 ? `, ${failCount} failed` : ""}`
          });
        }
        setHasUnsavedChanges(false);
        onClose();
        window.location.reload();
      }
    } catch (error) {
      console.error("Bulk update error:", error);
      if (notificationFn && typeof notificationFn.toggleNotification === "function") {
        notificationFn.toggleNotification({
          type: "danger",
          message: error?.response?.data?.error?.message || error?.message || "Failed to update entries"
        });
      } else if (typeof notificationFn === "function") {
        notificationFn({
          type: "danger",
          message: error?.response?.data?.error?.message || error?.message || "Failed to update entries"
        });
      }
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Modal.Root, { open: true, onOpenChange: handleClose, children: /* @__PURE__ */ jsxs(
      Modal.Content,
      {
        style: {
          width: "90vw",
          maxWidth: "1400px"
        },
        children: [
          /* @__PURE__ */ jsx(Modal.Header, { children: /* @__PURE__ */ jsxs(Box, { children: [
            /* @__PURE__ */ jsxs(Typography, { fontWeight: "bold", textColor: "neutral800", as: "h2", id: "title", children: [
              "Bulk Edit - ",
              documents.length,
              " ",
              documents.length === 1 ? "entry" : "entries"
            ] }),
            /* @__PURE__ */ jsxs(Typography, { variant: "omega", textColor: "neutral600", marginTop: 1, children: [
              "Drag the corner handle to fill values down. Cmd+click cells in same column to select multiple.",
              (schemaLoading || populatingRelations) && " Loading..."
            ] }),
            !schemaLoading && /* @__PURE__ */ jsx(Typography, { variant: "pi", textColor: "neutral500", marginTop: 2, children: "Note: Media fields are read-only previews. Edit them individually in each entry." })
          ] }) }),
          /* @__PURE__ */ jsx(
            Modal.Body,
            {
              style: {
                padding: 0,
                margin: 0
              },
              children: /* @__PURE__ */ jsx(
                Box,
                {
                  style: {
                    maxHeight: "60vh",
                    overflow: "auto",
                    border: "1px solid #dcdce4",
                    borderRadius: "4px",
                    padding: 0,
                    margin: 0
                  },
                  children: fields.length === 0 ? /* @__PURE__ */ jsx(Typography, { style: { padding: "20px" }, children: "No editable fields found for these entries." }) : /* @__PURE__ */ jsxs(
                    Table,
                    {
                      colCount: fields.length + 1,
                      rowCount: documents.length + 1,
                      style: {
                        width: "100%",
                        tableLayout: "auto"
                      },
                      children: [
                        /* @__PURE__ */ jsx(
                          Thead,
                          {
                            style: {
                              position: "sticky",
                              top: 0,
                              backgroundColor: "#f6f6f9",
                              zIndex: 1
                            },
                            children: /* @__PURE__ */ jsxs(Tr, { children: [
                              /* @__PURE__ */ jsx(
                                Th,
                                {
                                  style: {
                                    borderRight: "1px solid #dcdce4",
                                    borderBottom: "2px solid #dcdce4",
                                    backgroundColor: "#f6f6f9",
                                    width: "100px"
                                  },
                                  children: /* @__PURE__ */ jsx(Typography, { variant: "sigma", textColor: "neutral600", children: "ID" })
                                }
                              ),
                              fields.map((field) => {
                                const fieldSchema = getFieldType(field);
                                const headerTextWidth = field.length * 8 + 20;
                                let minWidth = Math.max(headerTextWidth, 100);
                                let maxWidth = "auto";
                                if (fieldSchema?.type === "boolean") {
                                  minWidth = Math.max(headerTextWidth, 100);
                                  maxWidth = "120px";
                                } else if (fieldSchema?.type === "media") {
                                  minWidth = Math.max(headerTextWidth, 100);
                                  maxWidth = "120px";
                                } else if (fieldSchema?.type === "date" || fieldSchema?.type === "datetime") {
                                  minWidth = Math.max(headerTextWidth, 160);
                                  maxWidth = "180px";
                                } else if (fieldSchema?.type === "integer" || fieldSchema?.type === "biginteger") {
                                  minWidth = Math.max(headerTextWidth, 100);
                                  maxWidth = "150px";
                                } else {
                                  minWidth = Math.max(headerTextWidth, 150);
                                  maxWidth = "300px";
                                }
                                return /* @__PURE__ */ jsx(
                                  Th,
                                  {
                                    style: {
                                      borderRight: "1px solid #dcdce4",
                                      borderBottom: "2px solid #dcdce4",
                                      backgroundColor: "#f6f6f9",
                                      minWidth: `${minWidth}px`,
                                      maxWidth,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    },
                                    children: /* @__PURE__ */ jsx(Typography, { variant: "sigma", textColor: "neutral600", children: field })
                                  },
                                  field
                                );
                              })
                            ] })
                          }
                        ),
                        /* @__PURE__ */ jsx(Tbody, { children: documents.map((doc) => {
                          const docId = doc.documentId || doc.id;
                          if (!docId) return null;
                          const editedDoc = editedEntries[docId] || doc;
                          return /* @__PURE__ */ jsxs(Tr, { children: [
                            /* @__PURE__ */ jsx(
                              Td,
                              {
                                style: {
                                  borderRight: "1px solid #dcdce4",
                                  borderBottom: "1px solid #dcdce4",
                                  backgroundColor: "#fafafa",
                                  fontWeight: 500
                                },
                                children: /* @__PURE__ */ jsxs(Typography, { textColor: "neutral800", variant: "omega", children: [
                                  String(docId).slice(0, 8),
                                  "..."
                                ] })
                              }
                            ),
                            fields.map((field) => {
                              const fieldSchema = getFieldType(field);
                              const isSelected = isInDragSelection(docId, field) || isCellSelected(docId, field);
                              const isMediaField = fieldSchema?.type === "media";
                              const isHovered = hoveredCell?.docId === docId && hoveredCell?.field === field;
                              return /* @__PURE__ */ jsx(
                                Td,
                                {
                                  onClick: (e) => handleCellClick(e, docId, field),
                                  onMouseEnter: () => {
                                    setHoveredCell({ docId, field });
                                    if (!isMediaField) handleDragOver(docId, field);
                                  },
                                  onMouseLeave: () => setHoveredCell(null),
                                  style: {
                                    position: "relative",
                                    backgroundColor: isSelected ? "#e0f2ff" : "white",
                                    borderRight: "1px solid #dcdce4",
                                    borderBottom: "1px solid #dcdce4",
                                    padding: "4px",
                                    userSelect: dragStart || selectedCells.size > 0 ? "none" : "auto",
                                    minHeight: "48px",
                                    verticalAlign: "middle",
                                    cursor: "default"
                                  },
                                  children: /* @__PURE__ */ jsxs("div", { style: { position: "relative" }, children: [
                                    renderFieldInput(docId, field, editedDoc[field], fieldSchema, populatingRelations),
                                    !isMediaField && isHovered && !populatingRelations && /* @__PURE__ */ jsx(
                                      "div",
                                      {
                                        onMouseDown: (e) => handleDragStart(e, docId, field),
                                        onMouseUp: handleDragEnd,
                                        style: {
                                          position: "absolute",
                                          bottom: "2px",
                                          right: "2px",
                                          width: "8px",
                                          height: "8px",
                                          backgroundColor: "#4945ff",
                                          cursor: "crosshair",
                                          borderRadius: "1px"
                                        }
                                      }
                                    )
                                  ] })
                                },
                                field
                              );
                            })
                          ] }, docId);
                        }) })
                      ]
                    }
                  )
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            Modal.Footer,
            {
              style: {
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px"
              },
              children: schema?.options?.draftAndPublish ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    onClick: () => handleSave(false),
                    variant: "secondary",
                    loading: saving,
                    disabled: fields.length === 0 || populatingRelations,
                    children: "Save All"
                  }
                ),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    onClick: () => handleSave(true),
                    loading: saving,
                    disabled: fields.length === 0 || populatingRelations,
                    children: "Publish All"
                  }
                )
              ] }) : /* @__PURE__ */ jsx(Button, { onClick: () => handleSave(false), loading: saving, disabled: fields.length === 0 || populatingRelations, children: "Save All Changes" })
            }
          )
        ]
      }
    ) }),
    showExitConfirm && /* @__PURE__ */ jsx(Modal.Root, { open: true, onOpenChange: handleCancelExit, children: /* @__PURE__ */ jsxs(Modal.Content, { children: [
      /* @__PURE__ */ jsx(Modal.Header, { children: /* @__PURE__ */ jsx(Typography, { fontWeight: "bold", textColor: "neutral800", as: "h2", children: "Unsaved Changes" }) }),
      /* @__PURE__ */ jsx(Modal.Body, { children: /* @__PURE__ */ jsx(Typography, { children: "You have unsaved changes. Are you sure you want to exit without saving?" }) }),
      /* @__PURE__ */ jsxs(Modal.Footer, { children: [
        /* @__PURE__ */ jsx(Button, { onClick: handleCancelExit, variant: "tertiary", children: "Continue Editing" }),
        /* @__PURE__ */ jsx(Button, { onClick: handleConfirmExit, variant: "danger", children: "Exit Without Saving" })
      ] })
    ] }) })
  ] });
};
const modalEmitter = {
  listeners: [],
  emit(data) {
    this.listeners.forEach((listener) => listener(data));
  },
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
};
const openBulkEditModal = (documents, model, notificationFn, fetchClient) => {
  modalEmitter.emit({ isOpen: true, documents, model, notificationFn, fetchClient });
};
const ModalManager = () => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    documents: [],
    model: "",
    notificationFn: null,
    fetchClient: null
  });
  useEffect(() => {
    const unsubscribe = modalEmitter.subscribe((data) => {
      setModalState(data);
    });
    return unsubscribe;
  }, []);
  if (!modalState.isOpen || !modalState.notificationFn || !modalState.fetchClient) {
    return null;
  }
  return /* @__PURE__ */ jsx(
    BulkEditModal,
    {
      documents: modalState.documents,
      contentType: modalState.model,
      onClose: () => setModalState({ isOpen: false, documents: [], model: "", notificationFn: null, fetchClient: null }),
      notificationFn: modalState.notificationFn,
      fetchClient: modalState.fetchClient
    }
  );
};
let modalMounted = false;
async function mountModalManager() {
  if (modalMounted) return;
  modalMounted = true;
  const ReactDOMClient = await import("./client-C1IU07a8.mjs").then((n) => n.c);
  const modalRoot = document.createElement("div");
  modalRoot.id = "bulk-editor-modal-root";
  document.body.appendChild(modalRoot);
  const root = ReactDOMClient.createRoot(modalRoot);
  root.render(
    /* @__PURE__ */ jsx(DesignSystemProvider, { locale: "en", children: /* @__PURE__ */ jsx(ModalManager, {}) })
  );
}
const index = {
  register(app) {
    app.registerPlugin({
      id: "bulk-editor",
      name: "Bulk Editor"
    });
  },
  bootstrap(app) {
    mountModalManager();
    const contentManager = app.getPlugin("content-manager");
    if (contentManager && contentManager.apis) {
      contentManager.apis.addBulkAction([
        function BulkEditAction({ documents, model }) {
          const toggleNotification = useNotification();
          const fetchClient = useFetchClient();
          const handleClick = () => {
            openBulkEditModal(documents, model, toggleNotification, fetchClient);
          };
          return {
            label: "Bulk Edit",
            icon: /* @__PURE__ */ jsx(Pencil, {}),
            onClick: handleClick
          };
        }
      ]);
    }
  },
  async registerTrads(app) {
    return [];
  }
};
export {
  index as default
};
