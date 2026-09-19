const bulkEditor = {
  // Fetch documents with all relations populated
  async getPopulated(ctx) {
    const { contentType, documentIds } = ctx.request.body;
    if (!contentType || !documentIds || !Array.isArray(documentIds)) {
      return ctx.badRequest("Missing or invalid contentType or documentIds");
    }
    try {
      const results = [];
      for (const docId of documentIds) {
        try {
          const doc = await strapi.documents(contentType).findOne({
            documentId: docId,
            populate: "*"
          });
          if (doc) {
            results.push(doc);
          }
        } catch (error) {
          console.error(`[BULK-EDITOR] Failed to fetch ${docId}:`, error.message);
        }
      }
      return ctx.send({
        success: true,
        documents: results
      });
    } catch (error) {
      console.error("[BULK-EDITOR] Fatal error:", error);
      return ctx.internalServerError("Failed to fetch documents", { error: error.message });
    }
  },
  async bulkUpdate(ctx) {
    const { contentType, updates, publish } = ctx.request.body;
    if (!contentType || !updates || !Array.isArray(updates)) {
      return ctx.badRequest("Missing or invalid contentType or updates");
    }
    try {
      const results = [];
      const contentTypeSchema = strapi.contentType(contentType);
      const relationFields = Object.entries(contentTypeSchema.attributes || {}).filter(([_, attr]) => attr.type === "relation").map(([name, attr]) => ({ name, relation: attr.relation, mappedBy: attr.mappedBy, inversedBy: attr.inversedBy }));
      const mappedByUpdates = /* @__PURE__ */ new Map();
      for (const update of updates) {
        const { id, data } = update;
        if (!id || !data) {
          results.push({ id, success: false, error: "Missing id or data" });
          continue;
        }
        const transformedData = { ...data };
        relationFields.forEach(({ name, relation, mappedBy }) => {
          if (name in transformedData) {
            const value = transformedData[name];
            const fieldAttr = contentTypeSchema.attributes[name];
            const isManyRelation = relation.includes("ToMany") || relation === "manyToMany";
            if (mappedBy) {
              const targetContentType = fieldAttr.target;
              delete transformedData[name];
              if (value !== null && value !== void 0 && value !== "") {
                if (!mappedByUpdates.has(targetContentType)) {
                  mappedByUpdates.set(targetContentType, /* @__PURE__ */ new Map());
                }
                const targetUpdates = mappedByUpdates.get(targetContentType);
                const targetDocId = String(value);
                if (!targetUpdates.has(targetDocId)) {
                  targetUpdates.set(targetDocId, []);
                }
                targetUpdates.get(targetDocId).push({ field: mappedBy, targetDocId: id });
              }
              return;
            }
            if (isManyRelation) {
              const ids = Array.isArray(value) ? value : [];
              transformedData[name] = { set: ids };
            } else {
              if (value === null || value === void 0 || value === "") {
                transformedData[name] = { set: [] };
              } else {
                transformedData[name] = { set: [value] };
              }
            }
          }
        });
        try {
          const updateOptions = {
            documentId: id,
            data: transformedData,
            populate: "*"
          };
          if (publish !== void 0) {
            updateOptions.status = publish ? "published" : "draft";
          }
          const updated = await strapi.documents(contentType).update(updateOptions);
          results.push({ id, success: true, data: updated });
        } catch (error) {
          console.error(`[BULK-EDITOR] Update failed for ${id}:`, error.message);
          results.push({ id, success: false, error: error.message });
        }
      }
      if (mappedByUpdates.size > 0) {
        for (const [targetContentType, targetUpdates] of mappedByUpdates.entries()) {
          for (const [targetDocId, updates2] of targetUpdates.entries()) {
            const fieldToIds = /* @__PURE__ */ new Map();
            for (const { field, targetDocId: galleryId } of updates2) {
              if (!fieldToIds.has(field)) {
                fieldToIds.set(field, []);
              }
              fieldToIds.get(field).push(galleryId);
            }
            const updateData = {};
            for (const [field, galleryIds] of fieldToIds.entries()) {
              updateData[field] = { set: galleryIds };
            }
            try {
              await strapi.documents(targetContentType).update({
                documentId: targetDocId,
                data: updateData
              });
            } catch (error) {
              console.error(`[BULK-EDITOR] Failed to update ${targetContentType}/${targetDocId}:`, error.message);
            }
          }
        }
      }
      return ctx.send({
        success: true,
        results
      });
    } catch (error) {
      console.error("[BULK-EDITOR] Fatal error:", error);
      return ctx.internalServerError("Bulk update failed", { error: error.message });
    }
  }
};
const controllers = {
  "bulk-editor": bulkEditor
};
const routes = [
  {
    method: "POST",
    path: "/bulk-update",
    handler: "bulk-editor.bulkUpdate",
    config: {
      policies: [],
      auth: false
    }
  },
  {
    method: "POST",
    path: "/get-populated",
    handler: "bulk-editor.getPopulated",
    config: {
      policies: [],
      auth: false
    }
  }
];
const services = {};
const index = {
  controllers,
  routes,
  services
};
export {
  index as default
};
