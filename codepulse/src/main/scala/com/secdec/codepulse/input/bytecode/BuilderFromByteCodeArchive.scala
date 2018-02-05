///*
// * Code Pulse: A real-time code coverage testing tool. For more information
// * see http://code-pulse.com
// *
// * Copyright (C) 2017 Applied Visions - http://securedecisions.avi.com
// *
// * Licensed under the Apache License, Version 2.0 (the "License");
// * you may not use this file except in compliance with the License.
// * You may obtain a copy of the License at
// *
// *     http://www.apache.org/licenses/LICENSE-2.0
// *
// * Unless required by applicable law or agreed to in writing, software
// * distributed under the License is distributed on an "AS IS" BASIS,
// * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// * See the License for the specific language governing permissions and
// * limitations under the License.
// */
//
//package com.secdec.codepulse.input.bytecode
//
//import java.io.File
//
//import com.secdec.codepulse.data.bytecode.{ AsmVisitors, CodeForestBuilder, CodeTreeNodeKind }
//import com.secdec.codepulse.data.dotnet.{ DotNet, SymbolReaderHTTPServiceConnector }
//import com.secdec.codepulse.data.jsp.{ JasperJspAdapter, JspAnalyzer }
//import com.secdec.codepulse.data.model.{ ProjectData, TreeNodeDataAccess, TreeNodeImporter }
//import com.secdec.codepulse.dependencycheck
//import com.secdec.codepulse.dependencycheck.DependencyCheckStatus
//import com.secdec.codepulse.events.GeneralEventBus
//import com.secdec.codepulse.input.{ BuilderFromArchive, LanguageBuilder }
//import com.secdec.codepulse.processing.ProcessStatus
//import com.secdec.codepulse.util.{ SmartLoader, ZipEntryChecker }
//import org.apache.commons.io.FilenameUtils
//
//class BuilderFromByteCodeArchive(val eventBus: GeneralEventBus) extends LanguageBuilder[CodeForestBuilder] {
////	override def process(projectData: ProjectData): CodeForestBuilder = {
////		println("~~~~~~~~~processing bytecode")
////		process(file, name, cleanup, projectData)
////	}
//
//	override def passesQuickCheck(file: File): Boolean = {
//		ZipEntryChecker.findFirstEntry(file) { (filename, entry, contents) =>
//			!entry.isDirectory && FilenameUtils.getExtension(entry.getName) == "class"
//		}
//	}
//
//	override def process(file: File, name: String, identifier: String, cleanup: => Unit, treeNodeData: TreeNodeDataAccess, status: ProcessStatus => Unit): CodeForestBuilder = {
//		val RootGroupName = "Classes"
//		val tracedGroups = (RootGroupName :: CodeForestBuilder.JSPGroupName :: Nil).toSet
//		val builder = new CodeForestBuilder
//		val methodCorrelationsBuilder = collection.mutable.Map.empty[String, Int]
//
//		//TODO: make this configurable somehow
//		val jspAdapter = new JasperJspAdapter
//
//		val loader = new SmartLoader
//
//		ZipEntryChecker.forEachEntry(file) { (filename, entry, contents) =>
//			val groupName = if (filename == file.getName) RootGroupName else s"JARs/${filename substring file.getName.length + 1}"
//			if (!entry.isDirectory) {
//				FilenameUtils.getExtension(entry.getName) match {
//					case "class" =>
//						val methods = AsmVisitors.parseMethodsFromClass(contents)
//						for {
//							(name, size) <- methods
//							treeNode <- builder.getOrAddMethod(groupName, name, size)
//						} methodCorrelationsBuilder += (name -> treeNode.id)
//
//					case "jsp" =>
//						val jspContents = loader loadStream contents
//						val jspSize = JspAnalyzer analyze jspContents
//						jspAdapter.addJsp(entry.getName, jspSize)
//
//					case _ => // nothing
//				}
//			} else if (entry.getName.endsWith("WEB-INF/")) {
//				jspAdapter addWebinf entry.getName
//			}
//		}
//
//		val jspCorrelations = jspAdapter build builder
//		val treemapNodes = builder.condensePathNodes().result
//		val methodCorrelations = methodCorrelationsBuilder.result
//
//		if (treemapNodes.isEmpty) {
//			throw new NoSuchElementException("No method data found in analyzed upload file.")
//		} else {
//			val importer = TreeNodeImporter(treeNodeData)
//
//			importer ++= treemapNodes.toIterable map {
//				case (root, node) =>
//					node -> (node.kind match {
//						case CodeTreeNodeKind.Grp | CodeTreeNodeKind.Pkg => Some(tracedGroups contains root.name)
//						case _ => None
//					})
//			}
//
//			importer.flush
//
//			treeNodeData.mapJsps(jspCorrelations)
//			treeNodeData.mapMethodSignatures(methodCorrelations)
//		}
//
//		builder
//	}
//
////	override def status(status: DependencyCheckStatus, vulnerableNodes: Seq[Int]): Unit = {}
////	override def fail(action: String, exception: Exception): Unit = {}
//}
