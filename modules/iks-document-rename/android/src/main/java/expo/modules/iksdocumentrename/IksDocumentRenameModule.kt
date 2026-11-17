package expo.modules.iksdocumentrename

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.database.Cursor
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class IksDocumentRenameModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IksDocumentRename")

    // Fast on-provider move for SAF documents. Unlike File.copy + delete this
    // usually changes directory metadata without transferring media bytes.
    // Only report UNSUPPORTED before invoking moveDocument; after invoking it,
    // a failure is potentially ambiguous and must NEVER trigger a blind copy.
    AsyncFunction("moveDocument") { sourceUriString: String, sourceTreeString: String, targetTreeString: String ->
      val context = requireNotNull(appContext.reactContext) { "App context unavailable" }
      val resolver = context.contentResolver
      val source = Uri.parse(sourceUriString)
      val fromTree = Uri.parse(sourceTreeString)
      val toTree = Uri.parse(targetTreeString)
      require(source.scheme == ContentResolver.SCHEME_CONTENT &&
              fromTree.scheme == ContentResolver.SCHEME_CONTENT &&
              toTree.scheme == ContentResolver.SCHEME_CONTENT) { "Expected SAF content URIs" }
      require(DocumentsContract.isDocumentUri(context, source)) { "Invalid source document URI" }
      if (source.authority != fromTree.authority || source.authority != toTree.authority) {
        throw UnsupportedOperationException("IKS_NATIVE_MOVE_UNSUPPORTED: Source and destination must be on the same Android document provider")
      }
      // getTreeDocumentId() always points to the *root* of a tree. Recycle
      // bins are child document URIs, so resolve their actual document IDs.
      val sourceParentId = if (DocumentsContract.isDocumentUri(context, fromTree))
        DocumentsContract.getDocumentId(fromTree) else DocumentsContract.getTreeDocumentId(fromTree)
      val targetParentId = if (DocumentsContract.isDocumentUri(context, toTree))
        DocumentsContract.getDocumentId(toTree) else DocumentsContract.getTreeDocumentId(toTree)
      if (sourceParentId == targetParentId) {
        throw IllegalArgumentException("Source and destination are the same directory")
      }
      val sourceParent = DocumentsContract.buildDocumentUriUsingTree(fromTree, sourceParentId)
      val targetParent = DocumentsContract.buildDocumentUriUsingTree(toTree, targetParentId)

      // Preflight: check capability and filename collision BEFORE attempting
      // the move. Do not silently overwrite an existing destination file.
      var filename: String? = null
      resolver.query(source, arrayOf(Document.COLUMN_DISPLAY_NAME, Document.COLUMN_FLAGS), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          filename = cursor.getString(0)
          val flags = cursor.getInt(1)
          if ((flags and Document.FLAG_SUPPORTS_MOVE) == 0) {
            throw UnsupportedOperationException("IKS_NATIVE_MOVE_UNSUPPORTED: This document provider does not advertise native Move support")
          }
        }
      }
      val name = filename ?: throw IllegalStateException("Source document is missing or cannot be read")
      val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(toTree, targetParentId)
      resolver.query(childrenUri, arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { cursor ->
        while (cursor.moveToNext()) {
          if (name.equals(cursor.getString(0), ignoreCase = true)) {
            throw IllegalStateException("Destination already contains an item named \"$name\". No files were changed.")
          }
        }
      } ?: throw IllegalStateException("Unable to check destination for filename collisions; move cancelled")

      // The provider may change document IDs/URIs when moving files.
      val moved = DocumentsContract.moveDocument(resolver, source, sourceParent, targetParent)
        ?: throw IllegalStateException("Android provider returned no URI after native Move. Refresh folders before retrying")
      val movedDocumentId = DocumentsContract.getDocumentId(moved)
      // Rebase the result on the destination tree's persisted permission.
      val destAccessUri = DocumentsContract.buildDocumentUriUsingTree(toTree, movedDocumentId)
      // Do not fall back to copying here: the move has already happened.
      resolver.query(destAccessUri, arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst() || cursor.getString(0) != name) {
          throw IllegalStateException("Native Move may have completed, but destination verification failed. Refresh folders before attempting again")
        }
      } ?: throw IllegalStateException("Native Move may have completed, but the destination URI is not accessible. Refresh folders")
      destAccessUri.toString()
    }

    // Fast delete without reading/copying video bytes. Create/reuse a hidden
    // per-source directory and move the document into that directory using
    // the same SAF provider. Undo moves it back via moveDocument().
    AsyncFunction("moveToRecycle") { sourceUriString: String, sourceTreeString: String, existingTrashUriString: String, folderName: String ->
      val context = requireNotNull(appContext.reactContext) { "App context unavailable" }
      val resolver = context.contentResolver
      val source = Uri.parse(sourceUriString)
      val tree = Uri.parse(sourceTreeString)
      require(source.scheme == ContentResolver.SCHEME_CONTENT && tree.scheme == ContentResolver.SCHEME_CONTENT) { "Expected SAF content URIs" }
      if (source.authority != tree.authority) {
        throw UnsupportedOperationException("IKS_NATIVE_TRASH_UNSUPPORTED: Different Android document providers")
      }
      require(DocumentsContract.isDocumentUri(context, source)) { "Invalid source document URI" }
      require(folderName.matches(Regex("^\\.imagekeysort-trash-[a-zA-Z0-9_-]{8,50}$"))) { "Invalid private trash folder name" }
      val rootId = DocumentsContract.getTreeDocumentId(tree)
      val root = DocumentsContract.buildDocumentUriUsingTree(tree, rootId)

      // Make sure the source is movable and the parent supports creating the
      // folder BEFORE moving any user data. Unsupported -> private-bin fallback.
      var name: String? = null
      resolver.query(source, arrayOf(Document.COLUMN_DISPLAY_NAME, Document.COLUMN_FLAGS), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
          name = c.getString(0)
          if ((c.getInt(1) and Document.FLAG_SUPPORTS_MOVE) == 0) {
            throw UnsupportedOperationException("IKS_NATIVE_TRASH_UNSUPPORTED: Provider does not support native moves")
          }
        }
      }
      val filename = name ?: throw IllegalStateException("Source document is missing")
      var trashId: String
      val trash: Uri
      if (existingTrashUriString.isNotBlank()) {
        val existing = Uri.parse(existingTrashUriString)
        require(existing.authority == tree.authority && existing.scheme == ContentResolver.SCHEME_CONTENT) { "Invalid existing trash URI" }
        require(DocumentsContract.getTreeDocumentId(existing) == rootId) { "Trash folder belongs to another source tree" }
        require(DocumentsContract.isDocumentUri(context, existing)) { "Trash must be a document URI" }
        var isOurTrash = false
        resolver.query(existing, arrayOf(Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE), null, null, null)?.use { c ->
          if (c.moveToFirst()) {
            isOurTrash = c.getString(0).startsWith(".imagekeysort-trash-") &&
              c.getString(1) == Document.MIME_TYPE_DIR
          }
        }
        if (!isOurTrash) throw IllegalStateException("Fast recycle directory is no longer accessible. Refresh source folder or empty old bin manually.")
        trash = existing
        trashId = DocumentsContract.getDocumentId(trash)
      } else {
        var supportsCreate = false
        resolver.query(root, arrayOf(Document.COLUMN_FLAGS), null, null, null)?.use { c ->
          if (c.moveToFirst()) supportsCreate = (c.getInt(0) and Document.FLAG_DIR_SUPPORTS_CREATE) != 0
        }
        if (!supportsCreate) {
          throw UnsupportedOperationException("IKS_NATIVE_TRASH_UNSUPPORTED: Cannot create a recycle directory inside this source folder")
        }
        // Generate a fresh name (caller persists it) so we never adopt an
        // unrelated existing folder or empty somebody else's files.
        val newFolder = DocumentsContract.createDocument(resolver, root, Document.MIME_TYPE_DIR, folderName)
          ?: throw IllegalStateException("Could not create private recycle directory")
        trashId = DocumentsContract.getDocumentId(newFolder)
        trash = DocumentsContract.buildDocumentUriUsingTree(tree, trashId)
      }

      // A filename can be deleted more than once (after another file with
      // the same name is created). In that case put the new deletion in its
      // own subfolder instead of overwriting the earlier recovery copy.
      var duplicate = false
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, trashId)
      resolver.query(children, arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
        while (c.moveToNext()) {
          if (filename.equals(c.getString(0), ignoreCase = true)) duplicate = true
        }
      } ?: throw IllegalStateException("Cannot check recycle folder; original unchanged")
      var destination = trash
      if (duplicate) {
        val nested = DocumentsContract.createDocument(
          resolver, trash, Document.MIME_TYPE_DIR,
          "duplicate-${System.currentTimeMillis()}-${(Math.random() * 100000).toInt()}"
        ) ?: throw IllegalStateException("Unable to preserve the previous recycled file with the same name")
        destination = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getDocumentId(nested))
      }

      // From here, a failed provider operation can be ambiguous. Never
      // silently try a second delete/copy or remove any document on error.
      val moved = DocumentsContract.moveDocument(resolver, source, root, destination)
        ?: throw IllegalStateException("Native recycle move returned no document URI; inspect source and bin before retrying")
      val movedUri = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getDocumentId(moved))
      resolver.query(movedUri, arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
        if (!c.moveToFirst() || c.getString(0) != filename) {
          throw IllegalStateException("Recycle move may have completed but verification failed; inspect the recycle folder")
        }
      } ?: throw IllegalStateException("Recycled document URI is inaccessible; inspect the recycle folder")
      mapOf("movedUri" to movedUri.toString(), "trashUri" to destination.toString(), "recycleRootUri" to trash.toString())
    }

    // This is intentionally stricter than clearing an arbitrary directory.
    // Only app-created, hidden SAF bins may be emptied, never the source root.
    AsyncFunction("emptyRecycle") { trashUriString: String ->
      val context = requireNotNull(appContext.reactContext) { "App context unavailable" }
      val resolver = context.contentResolver
      val trash = Uri.parse(trashUriString)
      require(trash.scheme == ContentResolver.SCHEME_CONTENT && DocumentsContract.isDocumentUri(context, trash)) { "Expected SAF recycle-folder document URI" }
      val rootId = DocumentsContract.getTreeDocumentId(trash)
      val trashId = DocumentsContract.getDocumentId(trash)
      require(trashId != rootId) { "Refusing to empty a source directory" }
      var valid = false
      resolver.query(trash, arrayOf(Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE), null, null, null)?.use { c ->
        if (c.moveToFirst()) valid = c.getString(0).startsWith(".imagekeysort-trash-") && c.getString(1) == Document.MIME_TYPE_DIR
      }
      require(valid) { "Refusing to empty an unknown or inaccessible directory" }
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(trash, trashId)
      val docs = mutableListOf<Uri>()
      resolver.query(children, arrayOf(Document.COLUMN_DOCUMENT_ID), null, null, null)?.use { c ->
        while (c.moveToNext()) docs.add(DocumentsContract.buildDocumentUriUsingTree(trash, c.getString(0)))
      } ?: throw IllegalStateException("Cannot enumerate recycle bin; nothing deleted")
      var count=0
      for (doc in docs) {
        if (!DocumentsContract.deleteDocument(resolver, doc)) throw IllegalStateException("Could not delete one or more recycled files; $count were removed")
        count++
      }
      count
    }

    AsyncFunction("renameDocument") { uriString: String, newName: String ->
      val context = requireNotNull(appContext.reactContext) { "App context unavailable" }
      val uri = Uri.parse(uriString)
      require(uri.scheme == ContentResolver.SCHEME_CONTENT) { "Expected a SAF content URI" }
      require(DocumentsContract.isDocumentUri(context, uri)) { "Not an Android document URI" }
      require(newName.isNotBlank() && '/' !in newName && '\u0000' !in newName) {
        "Invalid document name"
      }
      // Android's document provider owns the rename. It may return a new URI,
      // which MUST be used by the JS caller (the previous URI may be invalid).
      val updated = DocumentsContract.renameDocument(context.contentResolver, uri, newName)
        ?: throw IllegalStateException("Document provider refused to rename this file")
      updated.toString()
    }
  }
}
